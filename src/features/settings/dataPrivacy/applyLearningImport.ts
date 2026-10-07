import AsyncStorage from '@react-native-async-storage/async-storage';

import { currentRecordsOwner } from '@/features/games/records/useGameRecords';
import { safeJsonParse } from '@/services/storage/safeJson';
import type { PrivateDomain } from '@/services/sync/privateSync/domains';
import { knownDeletedKeys, usePrivateSyncStatus } from '@/services/sync/privateSync/privateSync';
import { STORE_ADAPTERS, type StoreAdapter } from '@/services/sync/privateSync/storeAdapters';
import { requestAccountSync } from '@/services/sync/syncTrigger';

import { planDomain, type DomainPlan, type ParsedBackup } from './learningImport';

/**
 * Stage 2 of Safe Learning Data Restore. Merge only (no "replace all"):
 *   1. load every affected store, read the CURRENT owner's slice
 *      (the owner comes from the signed-in session, never from the file);
 *   2. build the complete merged state for every domain first - the SAME
 *      plan the preview showed (`previewLearningImport` is this step alone);
 *   3. write it; if any write fails, every already-written domain is
 *      restored from its snapshot - all or nothing.
 * Afterwards Private Cloud Sync (when available) carries the change to
 * the account through its existing queue; nothing else is synced here.
 *
 * Interruptions: before step 3 a small "pending import" marker (owner +
 * a hash of the file - never its contents) is stored; it is cleared once
 * the stores have had time to persist. If the app stops in between, the
 * marker is still there next time and the screen says the last import may
 * not have finished - importing the same file again is safe (the merge is
 * idempotent) and completes it.
 */
export type ImportCloud = 'device_only_guest' | 'will_sync' | 'cloud_unavailable';
export type DomainSummary = Pick<DomainPlan, 'domain' | 'added' | 'updated' | 'unchanged' | 'skippedDeleted' | 'kept'>;
export type ImportFailure = 'owner_changed' | 'apply_failed' | 'apply_partial' | 'busy';
export type ImportPreview = { ok: true; owner: string; domains: DomainSummary[] } | { ok: false; error: 'owner_changed' };
export type ImportOutcome =
  | {
      ok: true;
      /** Domains the import changed or skipped something in. */
      domains: DomainSummary[];
      unchanged: PrivateDomain[];
      cloud: ImportCloud;
      /** False when the data changed between preview and import (then `domains` is what actually happened). */
      matchesPreview: boolean;
      /** Already merged on this device, but storage was behind (an earlier import that didn't
       * fully persist): written again now. Counts are unaffected - nothing is added twice. */
      repaired: PrivateDomain[];
    }
  | { ok: false; error: ImportFailure };

export type PendingImport = { owner: string; fingerprint: string; startedAt: string };

export type ImportDeps = {
  owner: () => string;
  adapters: readonly StoreAdapter[];
  deletedKeys: (owner: string) => Promise<Partial<Record<PrivateDomain, Set<string>>>>;
  cloud: (owner: string) => ImportCloud;
  requestSync: () => void;
  markPending: (pending: PendingImport) => Promise<boolean>;
  clearPending: () => Promise<void>;
  /** Resolves once the stores' own (debounced) writes have had time to run. */
  settle: () => Promise<void>;
  /** Adapters whose STORED slice for `owner` differs from memory (not persisted yet, or a failed write). */
  unpersisted: (adapters: readonly StoreAdapter[], owner: string) => Promise<StoreAdapter[]>;
};

/** Stored vs in-memory owner slice, per adapter (local reads only). */
async function unpersistedSlices(adapters: readonly StoreAdapter[], owner: string): Promise<StoreAdapter[]> {
  const keys = [...new Set(adapters.map((adapter) => adapter.persistence.key))];
  const pairs: readonly (readonly [string, string | null])[] | null = await AsyncStorage.multiGet(keys).catch(() => null);
  if (!pairs) return [...adapters];
  const stored = new Map(pairs.map(([key, raw]) => [key, safeJsonParse<Record<string, unknown> | null>(raw, null)]));
  return adapters.filter((adapter) => {
    const onDisk = stored.get(adapter.persistence.key)?.[owner];
    return JSON.stringify(onDisk ?? null) !== JSON.stringify(adapter.persistence.memorySlice(owner) ?? null);
  });
}

export const PENDING_IMPORT_KEY = 'oyno.dataImport.pending';
/** Longer than the longest store write debounce (reading / listening: 500 ms). */
const SETTLE_MS = 800;

export const defaultImportDeps: ImportDeps = {
  owner: currentRecordsOwner,
  adapters: STORE_ADAPTERS,
  deletedKeys: (owner) => knownDeletedKeys(owner).catch(() => ({})),
  cloud: (owner) => (owner === 'guest' ? 'device_only_guest' : usePrivateSyncStatus.getState().backend === 'available' ? 'will_sync' : 'cloud_unavailable'),
  requestSync: () => requestAccountSync('local_change'),
  markPending: (pending) => AsyncStorage.setItem(PENDING_IMPORT_KEY, JSON.stringify(pending)).then(
    () => true,
    () => false,
  ),
  clearPending: () => AsyncStorage.removeItem(PENDING_IMPORT_KEY).catch(() => undefined),
  settle: () => new Promise((resolve) => setTimeout(resolve, SETTLE_MS)),
  unpersisted: unpersistedSlices,
};

/** An import for THIS owner that started and never confirmed it finished. */
export async function readPendingImport(owner: string): Promise<PendingImport | null> {
  const pending = safeJsonParse<PendingImport | null>(await AsyncStorage.getItem(PENDING_IMPORT_KEY).catch(() => null), null);
  return pending && typeof pending === 'object' && pending.owner === owner && typeof pending.fingerprint === 'string' ? pending : null;
}

export async function dismissPendingImport(): Promise<void> {
  await defaultImportDeps.clearPending();
}

/** A short, non-reversible id of the file's text (FNV-1a) - recognises a re-import, reveals nothing. */
export function backupFingerprint(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${(h >>> 0).toString(36)}-${text.length.toString(36)}`;
}

type Prepared = { owner: string; plans: { adapter: StoreAdapter; plan: DomainPlan; snapshot: Record<string, unknown>; heldBefore: boolean }[] };

/** Steps 1-2: read + plan. No writes. null = the owner changed meanwhile. */
async function prepare(backup: ParsedBackup, expectedOwner: string, deps: ImportDeps): Promise<Prepared | null> {
  const owner = deps.owner();
  if (owner !== expectedOwner) return null;
  const domains = Object.keys(backup.records) as PrivateDomain[];
  const adapters = domains.map((domain) => deps.adapters.find((adapter) => adapter.domain === domain)).filter((adapter): adapter is StoreAdapter => !!adapter);
  await Promise.all(adapters.map((adapter) => adapter.load()));
  const deleted = await deps.deletedKeys(owner);
  if (deps.owner() !== owner) return null;
  return {
    owner,
    plans: adapters.map((adapter) => {
      const snapshot = adapter.read(owner);
      return { adapter, snapshot, heldBefore: adapter.holds(owner), plan: planDomain(adapter.domain, snapshot, backup.records[adapter.domain] ?? {}, deleted[adapter.domain]) };
    }),
  };
}

const summary = ({ domain, added, updated, unchanged, skippedDeleted, kept }: DomainPlan): DomainSummary => ({ domain, added, updated, unchanged, skippedDeleted, kept });
const sameSummary = (a: readonly DomainSummary[], b: readonly DomainSummary[]) => JSON.stringify(a) === JSON.stringify(b);

/** What importing would do for this owner right now (dry run - nothing is written). */
export async function previewLearningImport(backup: ParsedBackup, expectedOwner: string, deps: ImportDeps = defaultImportDeps): Promise<ImportPreview> {
  const prepared = await prepare(backup, expectedOwner, deps);
  if (!prepared) return { ok: false, error: 'owner_changed' };
  return { ok: true, owner: prepared.owner, domains: prepared.plans.map(({ plan }) => summary(plan)) };
}

let running = false;

/** Tests only. */
export function __resetImportLockForTests(): void {
  running = false;
}

export async function applyLearningImport(backup: ParsedBackup, expectedOwner: string, deps: ImportDeps = defaultImportDeps, options: { preview?: readonly DomainSummary[]; fingerprint?: string } = {}): Promise<ImportOutcome> {
  // One import at a time: a second tap (or a second screen) never applies the file concurrently.
  if (running) return { ok: false, error: 'busy' };
  running = true;
  try {
    return await run(backup, expectedOwner, deps, options);
  } finally {
    running = false;
  }
}

async function run(backup: ParsedBackup, expectedOwner: string, deps: ImportDeps, options: { preview?: readonly DomainSummary[]; fingerprint?: string }): Promise<ImportOutcome> {
  const prepared = await prepare(backup, expectedOwner, deps);
  if (!prepared) return { ok: false, error: 'owner_changed' };
  const { owner, plans } = prepared;
  const toWrite = plans.filter(({ plan }) => plan.added + plan.updated > 0);
  // Recovery: a domain with nothing new whose STORAGE is behind memory (an
  // earlier import - or anything else - that didn't persist) is written again.
  const unchanged = plans.filter(({ plan }) => plan.added + plan.updated === 0);
  const stale = new Set(await deps.unpersisted(unchanged.map(({ adapter }) => adapter), owner));
  const toRepair = unchanged.filter(({ adapter }) => stale.has(adapter));
  if (deps.owner() !== owner) return { ok: false, error: 'owner_changed' };

  const changing = toWrite.length + toRepair.length > 0;
  if (changing && !(await deps.markPending({ owner, fingerprint: options.fingerprint ?? 'unknown', startedAt: new Date().toISOString() }))) {
    // Can't even record that an import is starting: write nothing.
    return { ok: false, error: 'apply_failed' };
  }
  // The marker write was the last await before writing: re-check the owner.
  if (deps.owner() !== owner) {
    await deps.clearPending();
    return { ok: false, error: 'owner_changed' };
  }

  // 3: write all IN MEMORY (synchronously - no other code runs in between), or restore all.
  const written: (typeof plans)[number][] = [];
  try {
    for (const entry of toWrite) {
      entry.adapter.write(owner, entry.plan.next);
      written.push(entry);
    }
    for (const entry of toRepair) entry.adapter.write(owner, entry.adapter.read(owner));
  } catch {
    let restored = true;
    for (const entry of written.reverse()) {
      try {
        if (entry.heldBefore) entry.adapter.write(owner, entry.snapshot);
        else entry.adapter.forget(owner);
      } catch {
        restored = false;
      }
    }
    await deps.settle();
    if (restored) await deps.clearPending();
    // Not restored: the marker stays, so the next visit says so too.
    return { ok: false, error: restored ? 'apply_failed' : 'apply_partial' };
  }

  // 4: the stores persist on their own (debounced, errors swallowed) - so
  // CHECK what reached storage instead of assuming. Behind once: give the
  // debounce another moment. Still behind: a storage write failed - the
  // marker stays and the result says the import stopped partway; importing
  // the same file again repairs it (step "Recovery" above).
  if (changing) {
    const touched = [...written, ...toRepair].map(({ adapter }) => adapter);
    await deps.settle();
    let behind = await deps.unpersisted(touched, owner);
    if (behind.length > 0) {
      await deps.settle();
      behind = await deps.unpersisted(behind, owner);
    }
    if (behind.length > 0) return { ok: false, error: 'apply_partial' };
    await deps.clearPending();
  }
  const cloud = deps.cloud(owner);
  if (written.length > 0 && cloud === 'will_sync') deps.requestSync();
  const all = plans.map(({ plan }) => summary(plan));
  return {
    ok: true,
    domains: all.filter((entry) => entry.added + entry.updated + entry.skippedDeleted > 0),
    unchanged: all.filter((entry) => entry.added + entry.updated + entry.skippedDeleted === 0).map((entry) => entry.domain),
    cloud,
    matchesPreview: !options.preview || sameSummary(options.preview, all),
    repaired: toRepair.map(({ adapter }) => adapter.domain),
  };
}
