import { onlineManager } from '@tanstack/react-query';

import { entryToRow, mergeJournalEntries, rowToEntry, type JournalEntry, type ServerJournalRow } from '@/features/journal/journalModel';
import { track } from '@/services/analytics/analytics';
import { recordDiagnostic } from '@/services/feedback/diagnosticTrail';
import { cleanupStaleVersions, deleteLocalPhoto, downloadPhoto, journalPhotosSupported, uploadPhotoVersion } from '@/services/journal/journalPhotos';
import { supabase } from '@/services/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { useChallengeStore } from '@/store/useChallengeStore';
import { useDailyDiscoveryStore } from '@/store/useDailyDiscoveryStore';
import { useFavoritesStore } from '@/store/useFavoritesStore';
import { useJournalStore } from '@/store/useJournalStore';
import { useProgressStore } from '@/store/useProgressStore';
import { useWallpaperFavoritesStore, WALLPAPER_FAVORITE_PREFIX } from '@/store/useWallpaperFavoritesStore';

import { bumpAccountGeneration, captureAccountGeneration, isAccountGenerationCurrent } from './accountGeneration';
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
 *   - Private journal entries (20260923000003_journal.sql) + private,
 *     versioned photos (20260924000001_journal_photo_versions.sql)
 *
 * Each domain syncs independently - one failing (offline mid-sync, a
 * migration not applied yet) never blocks or rolls back the others, and
 * nothing local is dropped until the server has accepted it.
 *
 * STALE-RESULT SAFETY: every run captures the account-session generation
 * (accountGeneration.ts: user id + session number - so "A, session #1" and
 * "A, session #2" differ). Account transitions call `invalidateActiveSync()`
 * first, which starts a new generation. A run re-checks it right before
 * EVERY local mutation, so a slow response that arrives after the session
 * changed can never write into the stores. (The network request itself
 * isn't cancelled - its result is ignored.)
 */

export type SyncDomain = 'visits' | 'daily' | 'challenges' | 'favorites' | 'journal';

export type SyncReport = {
  ok: boolean;
  skipped?: 'not_signed_in' | 'offline' | 'account_changed';
  failedDomains: SyncDomain[];
  conflicts: number;
};

type SyncContext = { userId: string; generation: number; reason: SyncReason };

type DomainResult = { conflicts: number; changedProgress?: boolean };

class StaleSyncError extends Error {}

/** A short, content-free failure code for analytics (never a message). */
function safeCode(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' && /^[A-Za-z0-9_]{1,16}$/.test(code) ? code : 'error';
}

function signedInUserId(): string | null {
  const { status, user } = useAuthStore.getState();
  return status === 'authenticated' && user?.id ? user.id : null;
}

/** True while this run may still touch local state. */
function isCurrent(ctx: SyncContext): boolean {
  return isAccountGenerationCurrent(ctx);
}

/** Called right before every local mutation (and after every await). */
function assertCurrent(ctx: SyncContext): void {
  if (!isCurrent(ctx)) throw new StaleSyncError();
}

async function syncVisits(ctx: SyncContext): Promise<DomainResult> {
  const pending = await readPendingVisits();
  const accepted: string[] = [];
  let failure: unknown = null;
  for (const regionId of Object.keys(pending)) {
    assertCurrent(ctx);
    const { error } = await supabase.rpc('visit_explore_region', { p_region_id: regionId });
    // UNKNOWN_REGION: the place no longer exists - drop it, don't retry forever.
    if (!error || error.message?.includes('UNKNOWN_REGION')) accepted.push(regionId);
    else failure = error;
  }
  assertCurrent(ctx);
  await removePendingVisits(accepted);
  if (failure) throw failure;
  return { conflicts: 0, changedProgress: accepted.length > 0 };
}

async function syncDaily(ctx: SyncContext): Promise<DomainResult> {
  const { data, error } = await supabase.from('user_daily_completions').select('date_key, item_id');
  if (error) throw error;
  let serverRows = (data ?? []) as ServerDailyRow[];
  assertCurrent(ctx);

  const toPush = dailyToPush(useDailyDiscoveryStore.getState().completions, serverRows);
  if (toPush.length > 0) {
    const pushed = await supabase.rpc('merge_daily_completions', { p_items: toPush });
    if (pushed.error) throw pushed.error;
    serverRows = (pushed.data ?? []) as ServerDailyRow[];
  }

  assertCurrent(ctx);
  // Re-read local now: a day completed while this sync was in flight is kept.
  const local = useDailyDiscoveryStore.getState().completions;
  const { merged, conflicts } = mergeDailyCompletions(local, serverRows);
  if (JSON.stringify(merged) !== JSON.stringify(local)) await useDailyDiscoveryStore.getState().replaceAll(merged);
  return { conflicts };
}

async function syncChallenges(ctx: SyncContext): Promise<DomainResult> {
  const { data, error } = await supabase
    .from('user_challenge_results')
    .select('challenge_key, best_correct, last_correct, last_total, attempts, started_at, completed_at, updated_at');
  if (error) throw error;
  let serverRows = (data ?? []) as ServerChallengeRow[];
  assertCurrent(ctx);

  const first = mergeChallengeResults(useChallengeStore.getState().results, serverRows);
  if (first.toPush.length > 0) {
    const pushed = await supabase.rpc('merge_challenge_results', { p_items: first.toPush });
    if (pushed.error) throw pushed.error;
    serverRows = (pushed.data ?? []) as ServerChallengeRow[];
  }

  assertCurrent(ctx);
  const local = useChallengeStore.getState().results;
  const { merged } = mergeChallengeResults(local, serverRows);
  if (JSON.stringify(merged) !== JSON.stringify(local)) useChallengeStore.getState().replaceResults(merged);
  return { conflicts: first.conflicts };
}

function splitKey(key: string): { type: string; id: string } {
  const index = key.indexOf(':');
  return { type: key.slice(0, index), id: key.slice(index + 1) };
}

async function syncFavorites(ctx: SyncContext): Promise<DomainResult> {
  const { data, error } = await supabase.from('user_favorites').select('target_type, target_id, created_at');
  if (error) throw error;
  assertCurrent(ctx);

  const server = (data ?? []).map((row) => ({ key: `${row.target_type as string}:${row.target_id as string}`, createdAt: (row.created_at as string | null) ?? null }));
  const pending = await readPendingFavorites();
  const { desired, toAdd, toRemove, conflicts } = mergeFavorites(server, pending);

  // Only keys whose server state must change are written - one call each.
  const failed = new Set<string>();
  let failure: unknown = null;
  for (const key of [...toAdd, ...toRemove]) {
    assertCurrent(ctx);
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
  assertCurrent(ctx);
  await removeFavoriteOps(applied);

  // Visible state = account favorites + anything still waiting to sync.
  const finalSet = new Set(desired);
  for (const [key, op] of Object.entries(await readPendingFavorites())) {
    if (op.favorited) finalSet.add(key);
    else finalSet.delete(key);
  }
  assertCurrent(ctx);
  const all = Array.from(finalSet);
  useFavoritesStore.getState().applySynced(all.filter((key) => !key.startsWith(WALLPAPER_FAVORITE_PREFIX)));
  useWallpaperFavoritesStore.getState().applySynced(all.filter((key) => key.startsWith(WALLPAPER_FAVORITE_PREFIX)).map((key) => key.slice(WALLPAPER_FAVORITE_PREFIX.length)));

  if (failure) throw failure;
  return { conflicts };
}

function sameJournalRow(a: ServerJournalRow | undefined, b: ServerJournalRow): boolean {
  return !!a && a.updated_at === b.updated_at && a.photo_path === b.photo_path && a.deleted_at === b.deleted_at;
}

/** At most this many entries get a clean-up listing per sync. */
const PHOTO_CLEANUP_PER_SYNC = 10;

/**
 * Private journal. Order matters for photos:
 *   1. read the account, 2. decide which RECORD version wins per entry,
 *   3. upload photos only for winning local records (as new immutable
 *      versions), 4. save the winners, 5. tidy.
 * So an older offline device never uploads - let alone overwrites - a
 * photo for an entry whose newer version already lives in the account.
 */
async function syncJournal(ctx: SyncContext): Promise<DomainResult> {
  const { data, error } = await supabase
    .from('user_journal_entries')
    .select('id, title, note, memory_date, link_type, link_id, link_label, photo_path, created_at, updated_at, deleted_at');
  if (error) throw error;
  assertCurrent(ctx);
  const serverEntries = ((data ?? []) as ServerJournalRow[]).map(rowToEntry);
  const serverById = new Map(serverEntries.map((entry) => [entry.id, entry]));
  const localBefore = useJournalStore.getState().entries;

  // 2. Winners first.
  const { merged, conflicts } = mergeJournalEntries(localBefore, serverEntries);

  // 3. Photos of winning local records that the account doesn't have yet.
  let photoFailure: unknown = null;
  const winners: JournalEntry[] = [];
  for (const entry of merged) {
    const photo = entry.photo;
    const onServer = serverById.get(entry.id);
    const localWins = !onServer || entry.updatedAt > onServer.updatedAt;
    if (localWins && !entry.deletedAt && photo?.localUri && !photo.remotePath && photo.versionId) {
      try {
        assertCurrent(ctx);
        const remotePath = await uploadPhotoVersion(ctx.userId, entry.id, photo.versionId, photo.localUri);
        winners.push({ ...entry, photo: { ...photo, remotePath } });
        continue;
      } catch (uploadError) {
        if (uploadError instanceof StaleSyncError) throw uploadError;
        photoFailure = uploadError;
      }
    }
    winners.push(entry);
  }
  assertCurrent(ctx);

  // 4. Send only records the account doesn't already have as-is. A record
  //    whose photo failed to upload waits (never saved without its photo).
  const serverRows = new Map(serverEntries.map((entry) => [entry.id, entryToRow(entry)]));
  const toPush = winners
    .filter((entry) => !(entry.photo?.localUri && !entry.photo.remotePath && !entry.deletedAt))
    .map(entryToRow)
    .filter((row) => !sameJournalRow(serverRows.get(row.id), row));
  let returned = serverEntries;
  for (let start = 0; start < toPush.length; start += 100) {
    const pushed = await supabase.rpc('merge_journal_entries', { p_items: toPush.slice(start, start + 100) });
    if (pushed.error) throw pushed.error;
    returned = ((pushed.data ?? []) as ServerJournalRow[]).map(rowToEntry);
    assertCurrent(ctx);
  }
  const returnedById = new Map(returned.map((entry) => [entry.id, entry]));

  // 5. Apply: re-merge with edits made while this sync ran, then bring
  //    account photos onto this device.
  assertCurrent(ctx);
  const owner = ctx.userId;
  const combined = mergeJournalEntries(mergeJournalEntries(useJournalStore.getState().entries, winners).merged, returned).merged;
  const next: JournalEntry[] = [];
  for (const entry of combined) {
    const photo = entry.photo;
    if (!entry.deletedAt && photo?.remotePath && !photo.localUri && journalPhotosSupported()) {
      assertCurrent(ctx);
      const localUri = await downloadPhoto(photo.remotePath, entry.id, owner, photo.versionId ?? 'legacy').catch(() => null);
      next.push(localUri ? { ...entry, photo: { ...photo, localUri } } : entry);
    } else next.push(entry);
  }

  // Local files of records that lost (an older version's picture) are removed.
  const keptFiles = new Set(next.map((entry) => entry.photo?.localUri).filter(Boolean));
  assertCurrent(ctx);
  for (const entry of useJournalStore.getState().entries) {
    const uri = entry.photo?.localUri;
    if (uri && !keptFiles.has(uri)) deleteLocalPhoto(uri, owner);
  }
  await useJournalStore.getState().replaceAll(next);

  // Conservative cloud clean-up: only for entries whose account record is
  // confirmed (as returned by the server just now) and only versions that
  // record doesn't reference AND that are older than the grace period.
  const cleanupCandidates = next
    .filter((entry) => {
      const confirmed = returnedById.get(entry.id);
      if (!confirmed || confirmed.updatedAt !== entry.updatedAt) return false;
      const before = serverById.get(entry.id);
      return ctx.reason === 'app_start' || !before || before.photo?.remotePath !== confirmed.photo?.remotePath || before.deletedAt !== confirmed.deletedAt;
    })
    .slice(0, PHOTO_CLEANUP_PER_SYNC);
  for (const entry of cleanupCandidates) {
    if (!isCurrent(ctx)) break;
    await cleanupStaleVersions(ctx.userId, entry.id, entry.deletedAt ? null : (returnedById.get(entry.id)?.photo?.remotePath ?? null)).catch(() => 0);
  }

  if (photoFailure) throw photoFailure;
  return { conflicts };
}

const DOMAINS: [SyncDomain, (ctx: SyncContext) => Promise<DomainResult>][] = [
  ['visits', syncVisits],
  ['daily', syncDaily],
  ['challenges', syncChallenges],
  ['favorites', syncFavorites],
  ['journal', syncJournal],
];

async function runSync(reason: SyncReason, token: ReturnType<typeof captureAccountGeneration>): Promise<SyncReport> {
  const userId = token.userId;
  if (!userId) return { ok: false, skipped: 'not_signed_in', failedDomains: [], conflicts: 0 };
  if (!onlineManager.isOnline()) return { ok: false, skipped: 'offline', failedDomains: [], conflicts: 0 };
  const ctx: SyncContext = { userId, generation: token.generation, reason };
  if (!isCurrent(ctx)) return { ok: false, skipped: 'account_changed', failedDomains: [], conflicts: 0 };

  const startedAt = Date.now();
  track('sync_started', { reason });
  const failedDomains: SyncDomain[] = [];
  let conflicts = 0;
  let refreshProgress = reason === 'sign_in' || reason === 'reconnect';

  for (const [domain, run] of DOMAINS) {
    try {
      const result = await run(ctx);
      conflicts += result.conflicts;
      if (result.changedProgress) refreshProgress = true;
    } catch (error) {
      if (error instanceof StaleSyncError || !isCurrent(ctx)) return { ok: false, skipped: 'account_changed', failedDomains, conflicts };
      failedDomains.push(domain);
      track('sync_failed', { reason, domain, code: safeCode(error) });
      recordDiagnostic('sync_failed', domain);
    }
  }

  // Server-authoritative progress (XP, achievements, visits with their
  // real timestamps) is re-read so Passport/Journey/Home/Map all agree.
  // progress.load() gets this run's session and applies nothing if stale.
  if (refreshProgress && isCurrent(ctx)) await useProgressStore.getState().load({ userId: ctx.userId, generation: ctx.generation });
  if (!isCurrent(ctx)) return { ok: false, skipped: 'account_changed', failedDomains, conflicts };

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

/**
 * Makes every sync started so far "stale": whatever it receives later is
 * discarded instead of applied. Call BEFORE clearing or switching account
 * state. Also drops a queued/debounced run for the previous account.
 */
export function invalidateActiveSync(): void {
  bumpAccountGeneration();
  inFlight = null;
  queuedReason = null;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = null;
}

/** Runs a sync now; if one is already running, runs once more after it
 * (so edits made mid-sync are never missed) instead of in parallel. */
export function syncAccountState(reason: SyncReason): Promise<SyncReport> {
  if (inFlight) {
    queuedReason = reason;
    return inFlight;
  }
  const run = runSync(reason, captureAccountGeneration()).finally(() => {
    // An invalidated run must not clear or chain onto a newer one.
    if (inFlight !== run) return;
    inFlight = null;
    if (queuedReason) {
      const next = queuedReason;
      queuedReason = null;
      void syncAccountState(next);
    }
  });
  inFlight = run;
  return run;
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

registerSyncScheduler(scheduleAccountSync, signedInUserId);

/** Tests only. */
export function __resetSyncEngineForTests(): void {
  invalidateActiveSync();
}
