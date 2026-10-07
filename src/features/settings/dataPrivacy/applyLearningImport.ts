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
      /** The data is verified, but this import's "may not have finished" marker
       * couldn't be removed from storage - the warning may still show. */
      markerRemains: boolean;
    }
  | { ok: false; error: ImportFailure };

export type PendingImport = { owner: string; fingerprint: string; startedAt: string };

export type ImportDeps = {
  owner: () => string;
  adapters: readonly StoreAdapter[];
  deletedKeys: (owner: string) => Promise<Partial<Record<PrivateDomain, Set<string>>>>;
  cloud: (owner: string) => ImportCloud;
  requestSync: () => void;
  /** Adds this import's marker (other owners' / other backups' markers are kept). */
  markPending: (pending: PendingImport) => Promise<boolean>;
  /** Removes ONLY the marker for this owner + backup fingerprint. false = couldn't (storage error). */
  clearPending: (owner: string, fingerprint: string) => Promise<boolean>;
  /** Is there a marker for this owner + backup fingerprint (an earlier, unconfirmed import of the same file)? */
  hasPending: (owner: string, fingerprint: string) => Promise<boolean>;
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

const isMarker = (value: unknown): value is PendingImport => {
  const marker = value as PendingImport | null;
  return !!marker && typeof marker === 'object' && typeof marker.owner === 'string' && typeof marker.fingerprint === 'string' && marker.fingerprint.length <= 64 && typeof marker.startedAt === 'string';
};

/** Every stored marker (a list; a single object written by the previous version is read too). null = storage unreadable. */
async function readMarkers(): Promise<PendingImport[] | null> {
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(PENDING_IMPORT_KEY);
  } catch {
    return null;
  }
  const parsed = safeJsonParse<unknown>(raw, []);
  return (Array.isArray(parsed) ? parsed : [parsed]).filter(isMarker);
}

async function writeMarkers(markers: PendingImport[]): Promise<boolean> {
  const write = markers.length === 0 ? AsyncStorage.removeItem(PENDING_IMPORT_KEY) : AsyncStorage.setItem(PENDING_IMPORT_KEY, JSON.stringify(markers.slice(-20)));
  return write.then(
    () => true,
    () => false,
  );
}

const sameImport = (marker: PendingImport, owner: string, fingerprint: string) => marker.owner === owner && marker.fingerprint === fingerprint;

/** Marker writes never interleave (read-modify-write of one key). */
let markerQueue: Promise<unknown> = Promise.resolve();
function serializedMarkers<T>(task: () => Promise<T>): Promise<T> {
  const next = markerQueue.then(task, task);
  markerQueue = next.catch(() => undefined);
  return next;
}

export const defaultImportDeps: ImportDeps = {
  owner: currentRecordsOwner,
  adapters: STORE_ADAPTERS,
  deletedKeys: (owner) => knownDeletedKeys(owner).catch(() => ({})),
  cloud: (owner) => (owner === 'guest' ? 'device_only_guest' : usePrivateSyncStatus.getState().backend === 'available' ? 'will_sync' : 'cloud_unavailable'),
  requestSync: () => requestAccountSync('local_change'),
  markPending: (pending) =>
    serializedMarkers(async () => {
      const markers = await readMarkers();
      if (!markers) return false;
      return writeMarkers([...markers.filter((marker) => !sameImport(marker, pending.owner, pending.fingerprint)), pending]);
    }),
  clearPending: (owner, fingerprint) =>
    serializedMarkers(async () => {
      const markers = await readMarkers();
      if (!markers) return false;
      const kept = markers.filter((marker) => !sameImport(marker, owner, fingerprint));
      return kept.length === markers.length ? true : writeMarkers(kept);
    }),
  hasPending: async (owner, fingerprint) => ((await readMarkers()) ?? []).some((marker) => sameImport(marker, owner, fingerprint)),
  settle: () => new Promise((resolve) => setTimeout(resolve, SETTLE_MS)),
  unpersisted: unpersistedSlices,
};

/** An import for THIS owner that started and never confirmed it finished (the newest one). */
export async function readPendingImport(owner: string): Promise<PendingImport | null> {
  return ((await readMarkers()) ?? []).filter((marker) => marker.owner === owner).at(-1) ?? null;
}

/** "Dismiss" on the warning: this owner's markers only - never another account's. */
export function dismissPendingImport(owner: string): Promise<boolean> {
  return serializedMarkers(async () => {
    const markers = await readMarkers();
    if (!markers) return false;
    const kept = markers.filter((marker) => marker.owner !== owner);
    return kept.length === markers.length ? true : writeMarkers(kept);
  });
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
  const fingerprint = options.fingerprint ?? 'unknown';
  // An earlier import of this SAME file for this owner never confirmed it finished.
  const recovering = await deps.hasPending(owner, fingerprint);
  const toWrite = plans.filter(({ plan }) => plan.added + plan.updated > 0);
  // Recovery: a domain with nothing new whose STORAGE is behind memory (an
  // earlier import - or anything else - that didn't persist) is written again.
  const unchanged = plans.filter(({ plan }) => plan.added + plan.updated === 0);
  const stale = new Set(await deps.unpersisted(unchanged.map(({ adapter }) => adapter), owner));
  const toRepair = unchanged.filter(({ adapter }) => stale.has(adapter));
  if (deps.owner() !== owner) return { ok: false, error: 'owner_changed' };

  const changing = toWrite.length + toRepair.length > 0;
  if (changing && !(await deps.markPending({ owner, fingerprint, startedAt: new Date().toISOString() }))) {
    // Can't even record that an import is starting: write nothing.
    return { ok: false, error: 'apply_failed' };
  }
  // The marker write was the last await before writing: re-check the owner.
  if (deps.owner() !== owner) {
    // Nothing was written: remove the marker just added - but an earlier one for this file stays.
    if (changing && !recovering) await deps.clearPending(owner, fingerprint);
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
    // Restored = this attempt left no trace; an EARLIER unconfirmed import of this file still might have.
    if (restored && !recovering) await deps.clearPending(owner, fingerprint);
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
  }
  // Every domain of this backup is now verified in storage (written ones
  // above; the rest were compared with storage before writing and found
  // current) - so this file's marker can go, even when nothing was written
  // (the app closed after the data persisted but before the marker was removed).
  const markerRemains = changing || recovering ? !(await deps.clearPending(owner, fingerprint)) : false;
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
    markerRemains,
  };
}
