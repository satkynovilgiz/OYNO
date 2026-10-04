import { currentRecordsOwner } from '@/features/games/records/useGameRecords';
import type { PrivateDomain } from '@/services/sync/privateSync/domains';
import { knownDeletedKeys, usePrivateSyncStatus } from '@/services/sync/privateSync/privateSync';
import { STORE_ADAPTERS, type StoreAdapter } from '@/services/sync/privateSync/storeAdapters';
import { requestAccountSync } from '@/services/sync/syncTrigger';

import { planDomain, type DomainPlan, type ParsedBackup } from './learningImport';

/**
 * Stage 2 of Safe Learning Data Restore - runs ONLY after the person
 * confirmed the preview. Merge only (no "replace all"):
 *   1. load every affected store, read the CURRENT owner's slice
 *      (the owner comes from the signed-in session, never from the file);
 *   2. build the complete merged state for every domain first;
 *   3. write it; if any write fails, every already-written domain is
 *      restored from its snapshot - all or nothing.
 * Afterwards Private Cloud Sync (when available) carries the change to
 * the account through its existing queue; nothing else is synced here.
 */
export type ImportCloud = 'device_only_guest' | 'will_sync' | 'cloud_unavailable';
export type ImportOutcome =
  | { ok: true; domains: { domain: PrivateDomain; added: number; updated: number; skippedDeleted: number }[]; unchanged: PrivateDomain[]; cloud: ImportCloud }
  | { ok: false; error: 'owner_changed' | 'apply_failed' };

export type ImportDeps = {
  owner: () => string;
  adapters: readonly StoreAdapter[];
  deletedKeys: (owner: string) => Promise<Partial<Record<PrivateDomain, Set<string>>>>;
  cloud: (owner: string) => ImportCloud;
  requestSync: () => void;
};

const defaultDeps: ImportDeps = {
  owner: currentRecordsOwner,
  adapters: STORE_ADAPTERS,
  deletedKeys: (owner) => knownDeletedKeys(owner).catch(() => ({})),
  cloud: (owner) => (owner === 'guest' ? 'device_only_guest' : usePrivateSyncStatus.getState().backend === 'available' ? 'will_sync' : 'cloud_unavailable'),
  requestSync: () => requestAccountSync('local_change'),
};

export async function applyLearningImport(backup: ParsedBackup, expectedOwner: string, deps: ImportDeps = defaultDeps): Promise<ImportOutcome> {
  const owner = deps.owner();
  if (owner !== expectedOwner) return { ok: false, error: 'owner_changed' };
  const domains = Object.keys(backup.records) as PrivateDomain[];
  const adapters = domains.map((domain) => deps.adapters.find((adapter) => adapter.domain === domain)).filter((adapter): adapter is StoreAdapter => !!adapter);
  await Promise.all(adapters.map((adapter) => adapter.load()));
  const deleted = await deps.deletedKeys(owner);
  if (deps.owner() !== owner) return { ok: false, error: 'owner_changed' };

  // 1-2: everything is prepared before anything is written.
  const snapshots = new Map<StoreAdapter, Record<string, unknown>>();
  const heldBefore = new Map<StoreAdapter, boolean>();
  const plans: { adapter: StoreAdapter; plan: DomainPlan }[] = [];
  for (const adapter of adapters) {
    const current = adapter.read(owner);
    snapshots.set(adapter, current);
    heldBefore.set(adapter, adapter.holds(owner));
    plans.push({ adapter, plan: planDomain(adapter.domain, current, backup.records[adapter.domain] ?? {}, deleted[adapter.domain]) });
  }

  // 3: write all, or restore all.
  const written: StoreAdapter[] = [];
  try {
    for (const { adapter, plan } of plans) {
      if (plan.added + plan.updated === 0) continue;
      adapter.write(owner, plan.next);
      written.push(adapter);
    }
  } catch {
    for (const adapter of written.reverse()) {
      try {
        if (heldBefore.get(adapter)) adapter.write(owner, snapshots.get(adapter)!);
        else adapter.forget(owner);
      } catch {
        // Best effort; the original write already failed.
      }
    }
    return { ok: false, error: 'apply_failed' };
  }

  const cloud = deps.cloud(owner);
  if (written.length > 0 && cloud === 'will_sync') deps.requestSync();
  return {
    ok: true,
    domains: plans.filter(({ plan }) => plan.added + plan.updated + plan.skippedDeleted > 0).map(({ plan }) => ({ domain: plan.domain, added: plan.added, updated: plan.updated, skippedDeleted: plan.skippedDeleted })),
    unchanged: plans.filter(({ plan }) => plan.added + plan.updated + plan.skippedDeleted === 0).map(({ plan }) => plan.domain),
    cloud,
  };
}
