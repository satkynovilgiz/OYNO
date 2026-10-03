import AsyncStorage from '@react-native-async-storage/async-storage';
import { onlineManager } from '@tanstack/react-query';
import { create } from 'zustand';

import { safeJsonParse } from '@/services/storage/safeJson';
import { supabase } from '@/services/supabase/client';

import { captureAccountGeneration, isAccountGenerationCurrent } from '../accountGeneration';
import { currentAccountId } from '../syncTrigger';
import { PRIVATE_DOMAINS, type PrivateDomain } from './domains';
import { applyPushResult, preserveConcurrentEdits, reconcile, samePayload, type LedgerEntry, type PushItem, type ServerRecord } from './reconcile';
import { PRIVATE_STORES, STORE_ADAPTERS, type StoreAdapter } from './storeAdapters';

/**
 * Private Cloud Sync - signed-in accounts only; guests stay local.
 *
 * The device-local stores remain the source of truth on the device and
 * keep working offline: every edit is written locally at once. This
 * runner reconciles them with the account's private records
 * (public.user_state_records, owner-only RLS, writes only through
 * push_user_state() which derives the owner from auth.uid()).
 *
 * The "outbox" is implicit and needs no second queue: a record whose
 * local value differs from the ledger's base is unsynced. Both live in
 * AsyncStorage, so unsynced edits survive restarts. Pushes are
 * compare-and-swap on the record's revision, which makes retries
 * idempotent: a repeated push after a lost response is answered with the
 * already-stored row, which then equals the local value.
 */

const LEDGER_KEY = 'oyno.privateSync.v1';
/** Bounded re-tries per domain per run (a record another device keeps
 * changing waits for the next run - never an endless loop). */
const MAX_ROUNDS = 3;
const PUSH_CHUNK = 100;
const PAGE = 1000;
const LOCAL_CHANGE_DEBOUNCE_MS = 8000;

type OwnerLedger = Partial<Record<PrivateDomain, Record<string, LedgerEntry>>>;
type LedgerFile = { owners: Record<string, OwnerLedger>; syncedAt: Record<string, string> };

export type PrivateSyncState = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

/** Tiny status for Settings (no permanent banner anywhere). */
export const usePrivateSyncStatus = create<{ state: PrivateSyncState; owner: string | null; syncedOwners: Record<string, string> }>(() => ({ state: 'idle', owner: null, syncedOwners: {} }));

export class PrivateSyncStale extends Error {}

/** The server side (20261002000001_private_state_sync.sql) isn't deployed
 * yet: table / function missing. That is "not available", not a failure -
 * data stays on the device, nothing is retried in a loop, and the account
 * sync of every other domain is unaffected. */
function isBackendMissing(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return code === 'PGRST205' || code === 'PGRST202' || code === '42P01' || code === '42883';
}

type Token = { userId: string | null; generation: number };

let ledgerCache: LedgerFile | null = null;
async function readLedger(): Promise<LedgerFile> {
  if (ledgerCache) return ledgerCache;
  const parsed = safeJsonParse<Partial<LedgerFile>>(await AsyncStorage.getItem(LEDGER_KEY).catch(() => null), {});
  ledgerCache = {
    owners: parsed && typeof parsed.owners === 'object' && parsed.owners && !Array.isArray(parsed.owners) ? parsed.owners : {},
    syncedAt: parsed && typeof parsed.syncedAt === 'object' && parsed.syncedAt && !Array.isArray(parsed.syncedAt) ? parsed.syncedAt : {},
  };
  usePrivateSyncStatus.setState({ syncedOwners: { ...ledgerCache.syncedAt } });
  return ledgerCache;
}
async function writeLedger(file: LedgerFile): Promise<void> {
  ledgerCache = file;
  await AsyncStorage.setItem(LEDGER_KEY, JSON.stringify(file)).catch(() => {});
}

// Local writes made by the sync itself are not "local changes".
let applying = 0;
function applyQuietly(run: () => void): void {
  applying += 1;
  try {
    run();
  } finally {
    applying -= 1;
  }
}

// One run at a time (the engine's runs and local-change runs share it).
let chain: Promise<unknown> = Promise.resolve();
function exclusive<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(task, task);
  chain = run.catch(() => {});
  return run;
}

type PushResponse = { accepted: { key: string; rev: number; deleted: boolean; payload: unknown }[]; conflicts: { key: string; rev: number; deleted: boolean; payload: unknown }[] };

async function pullAll(): Promise<Map<PrivateDomain, Record<string, ServerRecord>>> {
  const byDomain = new Map<PrivateDomain, Record<string, ServerRecord>>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('user_state_records')
      .select('domain, record_key, rev, deleted, payload')
      .order('domain')
      .order('record_key')
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as { domain: string; record_key: string; rev: number; deleted: boolean; payload: unknown }[];
    for (const row of rows) {
      if (!(PRIVATE_DOMAINS as readonly string[]).includes(row.domain)) continue;
      const domain = row.domain as PrivateDomain;
      const records = byDomain.get(domain) ?? {};
      records[row.record_key] = { rev: Number(row.rev) || 0, deleted: !!row.deleted, payload: row.payload ?? null };
      byDomain.set(domain, records);
    }
    if (rows.length < PAGE) return byDomain;
  }
}

async function push(domain: PrivateDomain, items: PushItem[]): Promise<PushResponse> {
  const result: PushResponse = { accepted: [], conflicts: [] };
  for (let start = 0; start < items.length; start += PUSH_CHUNK) {
    const chunk = items.slice(start, start + PUSH_CHUNK).map((item) => ({ key: item.key, base_rev: item.baseRev, deleted: item.payload === null, payload: item.payload }));
    const { data, error } = await supabase.rpc('push_user_state', { p_domain: domain, p_items: chunk });
    if (error) throw error;
    const response = (data ?? {}) as Partial<PushResponse>;
    result.accepted.push(...(response.accepted ?? []));
    result.conflicts.push(...(response.conflicts ?? []));
  }
  return result;
}

/**
 * One domain for one owner. Returns how many records still wait (0 when
 * the device and the account agree).
 */
async function syncDomain(adapter: StoreAdapter, owner: string, server: Record<string, ServerRecord>, file: LedgerFile, check: () => void): Promise<{ pending: number; conflicts: number }> {
  let serverRecords = { ...server };
  let conflicts = 0;
  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const ownerLedger = file.owners[owner] ?? {};
    let ledger = ownerLedger[adapter.domain] ?? {};
    // Safety: if this device holds NOTHING for the owner (storage cleared,
    // or forgotten at sign-out) its old ledger must not turn into a wave
    // of deletions - start fresh and take the account's records.
    if (!adapter.holds(owner) && Object.keys(ledger).length > 0) ledger = {};

    const snapshot = adapter.read(owner);
    const result = reconcile(adapter.rules, snapshot, serverRecords, ledger);
    conflicts += result.conflicts;
    let nextLedger = result.ledger;
    let rejected: PushResponse['conflicts'] = [];
    const pushedKeys = new Set(result.push.map((item) => item.key));
    if (result.push.length > 0) {
      check();
      const response = await push(adapter.domain, result.push);
      check();
      nextLedger = applyPushResult(nextLedger, response.accepted);
      rejected = response.conflicts;
      for (const row of [...response.accepted, ...response.conflicts]) serverRecords[row.key] = { rev: row.rev, deleted: row.deleted, payload: row.payload };
    }

    check();
    const current = adapter.read(owner);
    const final = preserveConcurrentEdits(snapshot, current, result.local);
    // A key edited while the network call ran keeps its previous ledger
    // entry (unless it was just pushed), so the next run merges it
    // instead of overwriting the account's newer version.
    for (const key of new Set([...Object.keys(snapshot), ...Object.keys(current)])) {
      if (samePayload(snapshot[key] ?? null, current[key] ?? null) || pushedKeys.has(key)) continue;
      if (ledger[key]) nextLedger[key] = ledger[key];
      else delete nextLedger[key];
    }
    if (!samePayload(final, current) || !adapter.holds(owner)) applyQuietly(() => adapter.write(owner, final));
    file.owners[owner] = { ...(file.owners[owner] ?? {}), [adapter.domain]: nextLedger };
    await writeLedger(file);

    if (rejected.length === 0) return { pending: 0, conflicts };
  }
  return { pending: 1, conflicts };
}

/**
 * Reconciles every private domain for the signed-in account. Throws on a
 * network/server failure (local state is untouched by a failed domain)
 * and PrivateSyncStale when the account changed mid-run.
 */
export function syncPrivateState(token: Token): Promise<{ conflicts: number }> {
  return exclusive(async () => {
    const owner = token.userId;
    if (!owner) return { conflicts: 0 };
    const check = () => {
      if (!isAccountGenerationCurrent({ userId: owner, generation: token.generation })) throw new PrivateSyncStale();
    };
    check();
    if (!onlineManager.isOnline()) {
      usePrivateSyncStatus.setState({ state: 'offline', owner });
      throw Object.assign(new Error('offline'), { code: 'offline' });
    }
    usePrivateSyncStatus.setState({ state: 'syncing', owner });
    try {
      await Promise.all(STORE_ADAPTERS.map((adapter) => adapter.load()));
      const file = await readLedger();
      check();
      const server = await pullAll();
      check();
      let conflicts = 0;
      let pending = 0;
      for (const adapter of STORE_ADAPTERS) {
        const result = await syncDomain(adapter, owner, server.get(adapter.domain) ?? {}, file, check);
        conflicts += result.conflicts;
        pending += result.pending;
      }
      if (pending > 0) throw Object.assign(new Error('pending'), { code: 'pending' });
      file.syncedAt = { ...file.syncedAt, [owner]: new Date().toISOString() };
      await writeLedger(file);
      check();
      usePrivateSyncStatus.setState({ state: 'synced', owner, syncedOwners: { ...file.syncedAt } });
      return { conflicts };
    } catch (error) {
      if (isBackendMissing(error)) {
        usePrivateSyncStatus.setState({ state: 'idle', owner });
        return { conflicts: 0 };
      }
      if (!(error instanceof PrivateSyncStale)) usePrivateSyncStatus.setState({ state: onlineManager.isOnline() ? 'error' : 'offline', owner });
      throw error;
    }
  });
}

/**
 * Whether this device still has unsynced private edits for the owner -
 * used before forgetting an account's data at sign-out.
 */
export async function hasUnsyncedPrivateState(owner: string): Promise<boolean> {
  const file = await readLedger();
  const ownerLedger = file.owners[owner] ?? {};
  for (const adapter of STORE_ADAPTERS) {
    await adapter.load();
    const ledger = ownerLedger[adapter.domain] ?? {};
    const local = adapter.read(owner);
    const keys = new Set([...Object.keys(local), ...Object.keys(ledger)]);
    for (const key of keys) {
      const base = ledger[key]?.base ?? null;
      let held: unknown = local[key] ?? null;
      if (held === null && !adapter.rules.deletes) continue;
      if (held !== null && base !== null && adapter.rules.normalizeLocal) held = adapter.rules.normalizeLocal(base, held);
      if (!samePayload(held, base)) return true;
    }
  }
  return false;
}

/**
 * Sign-out after a COMPLETE sync (or account deletion): this account's
 * private data leaves the device - it is in the account and comes back
 * on the next sign-in. The ledger goes FIRST: a device holding a ledger
 * without the data could otherwise read the gap as deletions.
 */
export async function forgetPrivateState(owner: string): Promise<void> {
  if (!owner || owner === 'guest') return;
  const file = await readLedger();
  const owners = { ...file.owners };
  delete owners[owner];
  const syncedAt = { ...file.syncedAt };
  delete syncedAt[owner];
  await writeLedger({ owners, syncedAt });
  usePrivateSyncStatus.setState({ syncedOwners: syncedAt, state: 'idle', owner: null });
  await Promise.all(STORE_ADAPTERS.map((adapter) => adapter.load()));
  applyQuietly(() => {
    for (const adapter of STORE_ADAPTERS) adapter.forget(owner);
  });
}

// ---------------------------------------------------------------------
// Local edits -> a quiet, debounced sync for the signed-in account.
// ---------------------------------------------------------------------
let debounce: ReturnType<typeof setTimeout> | null = null;
let subscribed = false;

function schedule(): void {
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(() => {
    debounce = null;
    const token = captureAccountGeneration();
    if (!token.userId) return;
    void syncPrivateState(token).catch(() => undefined);
  }, LOCAL_CHANGE_DEBOUNCE_MS);
}

/** Starts watching the private stores (idempotent; called once at boot). */
export function watchPrivateStores(): void {
  if (subscribed) return;
  subscribed = true;
  void readLedger();
  for (const store of PRIVATE_STORES) {
    (store as { subscribe: (listener: (state: { saved?: Record<string, unknown>; sessions?: Record<string, unknown> }, previous: { saved?: Record<string, unknown>; sessions?: Record<string, unknown> }) => void) => () => void }).subscribe((state, previous) => {
      if (applying > 0) return;
      const owner = currentAccountId();
      if (!owner) return;
      if (state.saved?.[owner] !== previous.saved?.[owner] || state.sessions?.[owner] !== previous.sessions?.[owner]) schedule();
    });
  }
}

/** Tests only. */
export function __resetPrivateSyncForTests(): void {
  ledgerCache = null;
  if (debounce) clearTimeout(debounce);
  debounce = null;
  chain = Promise.resolve();
  usePrivateSyncStatus.setState({ state: 'idle', owner: null, syncedOwners: {} });
}
