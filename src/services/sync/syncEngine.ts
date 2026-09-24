import { onlineManager } from '@tanstack/react-query';

import { track } from '@/services/analytics/analytics';
import { entryToRow, mergeJournalEntries, rowToEntry, type JournalEntry, type ServerJournalRow } from '@/features/journal/journalModel';
import { recordDiagnostic } from '@/services/feedback/diagnosticTrail';
import { deleteRemotePhoto, downloadPhoto, journalPhotosSupported, uploadPhoto } from '@/services/journal/journalPhotos';
import { supabase } from '@/services/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { useChallengeStore } from '@/store/useChallengeStore';
import { useDailyDiscoveryStore } from '@/store/useDailyDiscoveryStore';
import { useFavoritesStore } from '@/store/useFavoritesStore';
import { useJournalStore } from '@/store/useJournalStore';
import { useProgressStore } from '@/store/useProgressStore';
import { useWallpaperFavoritesStore, WALLPAPER_FAVORITE_PREFIX } from '@/store/useWallpaperFavoritesStore';

import {
  dailyToPush,
  mergeChallengeResults,
  mergeDailyCompletions,
  mergeFavorites,
  type ServerChallengeRow,
  type ServerDailyRow,
} from './mergeRules';
import { readPendingFavorites, readPendingVisits, removeFavoriteOps, removePendingVisits } from './outbox';
import { registerSyncScheduler, type SyncReason } from './syncTrigger';

/**
 * THE sync layer: the one place that reconciles this device's local state
 * with a signed-in account. Stores stay local-first (they render from
 * AsyncStorage instantly and record unsynced edits in the outbox); this
 * engine runs in the background and never blocks startup.
 *
 * Server-backed state that already existed is reused, not duplicated:
 *   - XP/coins/streak/games/achievements/quest/discoveries: useProgressStore
 *     (server-authoritative RPCs; refreshed here after a sync)
 *   - Explore visits: user_region_visits via visit_explore_region (idempotent)
 *   - Favorites + wallpaper favorites: user_favorites via toggle_favorite
 * New account tables (20260923000001_account_sync.sql):
 *   - Daily OYNO completions, Knowledge Challenge results
 *   - Private journal entries (20260923000003_journal.sql) + private photos
 *
 * Each domain syncs independently - one failing (offline mid-sync, a
 * migration not applied yet) never blocks or rolls back the others, and
 * nothing local is dropped until the server has accepted it.
 */

export type SyncDomain = 'visits' | 'daily' | 'challenges' | 'favorites' | 'journal';

export type SyncReport = {
  ok: boolean;
  skipped?: 'not_signed_in' | 'offline' | 'account_changed';
  failedDomains: SyncDomain[];
  conflicts: number;
};

type DomainResult = { conflicts: number; changedProgress?: boolean };

class AccountChangedError extends Error {}

/** A short, content-free failure code for analytics (never a message). */
function safeCode(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' && /^[A-Za-z0-9_]{1,16}$/.test(code) ? code : 'error';
}

function signedInUserId(): string | null {
  const { status, user } = useAuthStore.getState();
  return status === 'authenticated' && user?.id ? user.id : null;
}

/** Never apply one account's server data after the user changed mid-sync. */
function assertSameAccount(userId: string): void {
  if (signedInUserId() !== userId) throw new AccountChangedError();
}

async function syncVisits(userId: string): Promise<DomainResult> {
  const pending = await readPendingVisits();
  const accepted: string[] = [];
  let failure: unknown = null;
  for (const regionId of Object.keys(pending)) {
    assertSameAccount(userId);
    const { error } = await supabase.rpc('visit_explore_region', { p_region_id: regionId });
    // UNKNOWN_REGION: the place no longer exists - drop it, don't retry forever.
    if (!error || error.message?.includes('UNKNOWN_REGION')) accepted.push(regionId);
    else failure = error;
  }
  await removePendingVisits(accepted);
  if (failure) throw failure;
  return { conflicts: 0, changedProgress: accepted.length > 0 };
}

async function syncDaily(userId: string): Promise<DomainResult> {
  const { data, error } = await supabase.from('user_daily_completions').select('date_key, item_id');
  if (error) throw error;
  let serverRows = (data ?? []) as ServerDailyRow[];
  assertSameAccount(userId);

  const toPush = dailyToPush(useDailyDiscoveryStore.getState().completions, serverRows);
  if (toPush.length > 0) {
    const pushed = await supabase.rpc('merge_daily_completions', { p_items: toPush });
    if (pushed.error) throw pushed.error;
    serverRows = (pushed.data ?? []) as ServerDailyRow[];
    assertSameAccount(userId);
  }

  // Re-read local now: a day completed while this sync was in flight is kept.
  const local = useDailyDiscoveryStore.getState().completions;
  const { merged, conflicts } = mergeDailyCompletions(local, serverRows);
  if (JSON.stringify(merged) !== JSON.stringify(local)) await useDailyDiscoveryStore.getState().replaceAll(merged);
  return { conflicts };
}

async function syncChallenges(userId: string): Promise<DomainResult> {
  const { data, error } = await supabase
    .from('user_challenge_results')
    .select('challenge_key, best_correct, last_correct, last_total, attempts, started_at, completed_at, updated_at');
  if (error) throw error;
  let serverRows = (data ?? []) as ServerChallengeRow[];
  assertSameAccount(userId);

  const first = mergeChallengeResults(useChallengeStore.getState().results, serverRows);
  if (first.toPush.length > 0) {
    const pushed = await supabase.rpc('merge_challenge_results', { p_items: first.toPush });
    if (pushed.error) throw pushed.error;
    serverRows = (pushed.data ?? []) as ServerChallengeRow[];
    assertSameAccount(userId);
  }

  const local = useChallengeStore.getState().results;
  const { merged } = mergeChallengeResults(local, serverRows);
  if (JSON.stringify(merged) !== JSON.stringify(local)) useChallengeStore.getState().replaceResults(merged);
  return { conflicts: first.conflicts };
}

function splitKey(key: string): { type: string; id: string } {
  const index = key.indexOf(':');
  return { type: key.slice(0, index), id: key.slice(index + 1) };
}

async function syncFavorites(userId: string): Promise<DomainResult> {
  const { data, error } = await supabase.from('user_favorites').select('target_type, target_id, created_at');
  if (error) throw error;
  assertSameAccount(userId);

  const server = (data ?? []).map((row) => ({ key: `${row.target_type as string}:${row.target_id as string}`, createdAt: (row.created_at as string | null) ?? null }));
  const pending = await readPendingFavorites();
  const { desired, toAdd, toRemove, conflicts } = mergeFavorites(server, pending);

  // Only keys whose server state must change are written - one call each.
  const failed = new Set<string>();
  let failure: unknown = null;
  for (const key of [...toAdd, ...toRemove]) {
    assertSameAccount(userId);
    const { type, id } = splitKey(key);
    const shouldBeFavorited = toAdd.includes(key);
    let { data: nowFavorited, error: writeError } = await supabase.rpc('toggle_favorite', { p_target_type: type, p_target_id: id });
    // toggle_favorite flips; if another device changed this key since the
    // read above, the flip landed the wrong way - flip once more.
    if (!writeError && typeof nowFavorited === 'boolean' && nowFavorited !== shouldBeFavorited) {
      ({ data: nowFavorited, error: writeError } = await supabase.rpc('toggle_favorite', { p_target_type: type, p_target_id: id }));
    }
    if (writeError) {
      failed.add(key);
      failure = writeError;
    }
  }

  // Every edit that is now reflected on the server (or was a no-op / lost
  // to a newer server change) leaves the outbox; failed ones stay queued.
  const applied: Record<string, string> = {};
  for (const [key, op] of Object.entries(pending)) if (!failed.has(key)) applied[key] = op.at;
  await removeFavoriteOps(applied);
  assertSameAccount(userId);

  // Visible state = account favorites + anything still waiting to sync.
  const finalSet = new Set(desired);
  for (const [key, op] of Object.entries(await readPendingFavorites())) {
    if (op.favorited) finalSet.add(key);
    else finalSet.delete(key);
  }
  const all = Array.from(finalSet);
  useFavoritesStore.getState().applySynced(all.filter((key) => !key.startsWith(WALLPAPER_FAVORITE_PREFIX)));
  useWallpaperFavoritesStore.getState().applySynced(all.filter((key) => key.startsWith(WALLPAPER_FAVORITE_PREFIX)).map((key) => key.slice(WALLPAPER_FAVORITE_PREFIX.length)));

  if (failure) throw failure;
  return { conflicts };
}

function sameJournalRow(a: ServerJournalRow | undefined, b: ServerJournalRow): boolean {
  return !!a && a.updated_at === b.updated_at && a.photo_path === b.photo_path && a.deleted_at === b.deleted_at;
}

/**
 * Private journal: newest record per entry wins, deletions are tombstones.
 * Photos go to the user's own private folder first; a failed photo upload
 * never blocks the text (it's retried next sync).
 */
async function syncJournal(userId: string): Promise<DomainResult> {
  const { data, error } = await supabase
    .from('user_journal_entries')
    .select('id, title, note, memory_date, link_type, link_id, link_label, photo_path, created_at, updated_at, deleted_at');
  if (error) throw error;
  assertSameAccount(userId);
  const serverEntries = ((data ?? []) as ServerJournalRow[]).map(rowToEntry);

  // 1. Photos that exist only on this device go up first.
  let photoFailure: unknown = null;
  const withPhotos: JournalEntry[] = [];
  for (const entry of useJournalStore.getState().entries) {
    if (!entry.deletedAt && entry.photo?.localUri && !entry.photo.remotePath) {
      try {
        const remotePath = await uploadPhoto(userId, entry.id, entry.photo.localUri);
        withPhotos.push({ ...entry, photo: { ...entry.photo, remotePath } });
        continue;
      } catch (uploadError) {
        photoFailure = uploadError;
      }
    }
    withPhotos.push(entry);
  }
  assertSameAccount(userId);

  // 2. Merge and send only entries the server doesn't already have as-is.
  const { merged, conflicts } = mergeJournalEntries(withPhotos, serverEntries);
  const serverRows = new Map(serverEntries.map((entry) => [entry.id, entryToRow(entry)]));
  const toPush = merged.map(entryToRow).filter((row) => !sameJournalRow(serverRows.get(row.id), row));
  let returned = serverEntries;
  for (let start = 0; start < toPush.length; start += 100) {
    const pushed = await supabase.rpc('merge_journal_entries', { p_items: toPush.slice(start, start + 100) });
    if (pushed.error) throw pushed.error;
    returned = ((pushed.data ?? []) as ServerJournalRow[]).map(rowToEntry);
    assertSameAccount(userId);
  }

  // 3. Apply (re-merging edits made while this sync ran), then tidy photos:
  //    deleted entries lose their cloud photo; restored ones get it back.
  let final = mergeJournalEntries(mergeJournalEntries(useJournalStore.getState().entries, withPhotos).merged, returned).merged;
  const next: JournalEntry[] = [];
  for (const entry of final) {
    if (entry.deletedAt && entry.photo?.remotePath) {
      await deleteRemotePhoto(entry.photo.remotePath).catch(() => {});
      next.push({ ...entry, photo: null });
    } else if (!entry.deletedAt && entry.photo?.remotePath && !entry.photo.localUri && journalPhotosSupported()) {
      const localUri = await downloadPhoto(entry.photo.remotePath, entry.id).catch(() => null);
      next.push(localUri ? { ...entry, photo: { ...entry.photo, localUri } } : entry);
    } else next.push(entry);
  }
  final = next;
  assertSameAccount(userId);
  await useJournalStore.getState().replaceAll(final);

  if (photoFailure) throw photoFailure;
  return { conflicts };
}

const DOMAINS: [SyncDomain, (userId: string) => Promise<DomainResult>][] = [
  ['visits', syncVisits],
  ['daily', syncDaily],
  ['challenges', syncChallenges],
  ['favorites', syncFavorites],
  ['journal', syncJournal],
];

async function runSync(reason: SyncReason): Promise<SyncReport> {
  const userId = signedInUserId();
  if (!userId) return { ok: false, skipped: 'not_signed_in', failedDomains: [], conflicts: 0 };
  if (!onlineManager.isOnline()) return { ok: false, skipped: 'offline', failedDomains: [], conflicts: 0 };

  const startedAt = Date.now();
  track('sync_started', { reason });
  const failedDomains: SyncDomain[] = [];
  let conflicts = 0;
  let refreshProgress = reason === 'sign_in' || reason === 'reconnect';

  for (const [domain, run] of DOMAINS) {
    try {
      const result = await run(userId);
      conflicts += result.conflicts;
      if (result.changedProgress) refreshProgress = true;
    } catch (error) {
      if (error instanceof AccountChangedError) return { ok: false, skipped: 'account_changed', failedDomains, conflicts };
      failedDomains.push(domain);
      track('sync_failed', { reason, domain, code: safeCode(error) });
      recordDiagnostic('sync_failed', domain);
    }
  }

  // Server-authoritative progress (XP, achievements, visits with their
  // real timestamps) is re-read so Passport/Journey/Home/Map all agree.
  if (refreshProgress && signedInUserId() === userId) await useProgressStore.getState().load();

  if (conflicts > 0) track('sync_conflict_merged', { reason, count: conflicts });
  const ok = failedDomains.length === 0;
  track('sync_completed', { reason, ok, failed: failedDomains.length, ms: Date.now() - startedAt });
  return { ok, failedDomains, conflicts };
}

// ---------------------------------------------------------------------
// Scheduling: single-flight, debounced for bursts of local edits.
// ---------------------------------------------------------------------

let inFlight: Promise<SyncReport> | null = null;
let queuedReason: SyncReason | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const LOCAL_CHANGE_DEBOUNCE_MS = 1500;

/** Runs a sync now; if one is already running, runs once more after it
 * (so edits made mid-sync are never missed) instead of in parallel. */
export function syncAccountState(reason: SyncReason): Promise<SyncReport> {
  if (inFlight) {
    queuedReason = reason;
    return inFlight;
  }
  inFlight = runSync(reason).finally(() => {
    inFlight = null;
    if (queuedReason) {
      const next = queuedReason;
      queuedReason = null;
      void syncAccountState(next);
    }
  });
  return inFlight;
}

export function scheduleAccountSync(reason: SyncReason): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(
    () => {
      debounceTimer = null;
      void syncAccountState(reason);
    },
    reason === 'local_change' ? LOCAL_CHANGE_DEBOUNCE_MS : 0,
  );
}

registerSyncScheduler(scheduleAccountSync, () => signedInUserId() !== null);

/** Tests only. */
export function __resetSyncEngineForTests(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = null;
  inFlight = null;
  queuedReason = null;
}
