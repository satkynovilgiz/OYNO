import AsyncStorage from '@react-native-async-storage/async-storage';

import { safeJsonParse } from '@/services/storage/safeJson';
import { registerAccountHooks } from '@/store/useAuthStore';
import { useAvatarStore } from '@/store/useAvatarStore';
import { type ChallengeResult, useChallengeStore } from '@/store/useChallengeStore';
import { type DailyCompletions, useDailyDiscoveryStore } from '@/store/useDailyDiscoveryStore';
import { useFavoritesStore } from '@/store/useFavoritesStore';
import { JOURNAL_STORAGE_KEY, mergeJournalStash, useJournalStore } from '@/store/useJournalStore';
import { useWallpaperFavoritesStore, WALLPAPER_FAVORITE_PREFIX } from '@/store/useWallpaperFavoritesStore';

import {
  clearAccountBoundState,
  discardAccountStash,
  readAccountOwner,
  stashAccountState,
  takeAccountStash,
  writeAccountOwner,
} from './accountScope';
import { mergeChallengeResult } from './mergeRules';
import {
  mergeFavoriteOps,
  mergePendingVisits,
  PENDING_FAVORITES_KEY,
  PENDING_VISITS_KEY,
  readPendingFavorites,
  recordFavoriteOp,
  type PendingFavorites,
  type PendingVisits,
} from './outbox';
import { syncAccountState, type SyncReport } from './syncEngine';

/**
 * Account transitions for the local, account-bound state:
 *
 *  guest -> signs in       The guest's visits, Daily completions,
 *                          challenge results and favorites are MERGED into
 *                          the account (never erased, never shown a
 *                          migration screen - every merge rule is
 *                          automatic; see mergeRules.ts).
 *  account A -> signs out  A last sync runs while the session exists; then
 *                          A's local state is cleared so the next person
 *                          sees none of it. If that sync couldn't finish
 *                          (offline), the unsynced state is set aside for
 *                          A only and merged back the next time A signs in.
 *                          Server progress is never deleted.
 *  device held A's data,
 *  B signs in              A's leftovers are cleared first - never merged
 *                          into B.
 */

const SIGN_OUT_SYNC_TIMEOUT_MS = 5000;

async function ensureLocalStoresLoaded(): Promise<void> {
  const loads: Promise<void>[] = [];
  if (!useDailyDiscoveryStore.getState().isLoaded) loads.push(useDailyDiscoveryStore.getState().load());
  if (!useChallengeStore.getState().isLoaded) loads.push(useChallengeStore.getState().load());
  if (!useWallpaperFavoritesStore.getState().isLoaded) loads.push(useWallpaperFavoritesStore.getState().load());
  if (!useJournalStore.getState().isLoaded) loads.push(useJournalStore.getState().load());
  await Promise.all(loads);
}

/** In-memory account state back to empty (storage is cleared separately). */
function resetAccountStores(): void {
  useDailyDiscoveryStore.getState().reset();
  useChallengeStore.getState().reset();
  useFavoritesStore.getState().reset();
  useWallpaperFavoritesStore.getState().reset();
  useJournalStore.getState().reset();
  // Progress and avatar re-load themselves on the auth status change
  // (root layout) and now find no cached account data to show.
}

/** A guest's favorites become "add" edits for the account - union only. */
async function seedGuestFavorites(): Promise<void> {
  const pending = await readPendingFavorites();
  const now = new Date().toISOString();
  const keys = [
    ...useFavoritesStore.getState().favoriteIds,
    ...useWallpaperFavoritesStore.getState().ids.map((id) => `${WALLPAPER_FAVORITE_PREFIX}${id}`),
  ];
  for (const key of keys) {
    if (!pending[key]) await recordFavoriteOp(key, { favorited: true, at: now, origin: 'guest' });
  }
}

function parse<T>(raw: string | undefined, fallback: T): T {
  return raw ? safeJsonParse<T>(raw, fallback) : fallback;
}

/** Merges a signed-out account's set-aside state back in (same rules as sync). */
async function restoreStash(stash: Record<string, string>): Promise<void> {
  const daily = parse<DailyCompletions>(stash['oyno.daily.completions'], {});
  if (Object.keys(daily).length > 0) {
    await useDailyDiscoveryStore.getState().replaceAll({ ...daily, ...useDailyDiscoveryStore.getState().completions });
  }

  const challenges = parse<{ results?: Record<string, ChallengeResult> }>(stash['oyno.challenges.v1'], {}).results ?? {};
  if (Object.keys(challenges).length > 0) {
    const current = useChallengeStore.getState().results;
    const merged: Record<string, ChallengeResult> = { ...current };
    for (const [key, result] of Object.entries(challenges)) merged[key] = mergeChallengeResult(current[key], result)!;
    useChallengeStore.getState().replaceResults(merged);
  }

  await mergeJournalStash(stash[JOURNAL_STORAGE_KEY]);
  await mergePendingVisits(parse<PendingVisits>(stash[PENDING_VISITS_KEY], {}));
  await mergeFavoriteOps(parse<PendingFavorites>(stash[PENDING_FAVORITES_KEY], {}));

  // An avatar edit that never reached the server comes back as-is.
  const avatar = stash['oyno.avatar.cache'];
  if (avatar && parse<{ dirty?: boolean }>(avatar, {}).dirty) {
    await AsyncStorage.setItem('oyno.avatar.cache', avatar).catch(() => {});
    void useAvatarStore.getState().load();
  }
}

/**
 * Called when a signed-in session is known (app start or a fresh sign-in).
 * Local state is already on screen; this only reconciles, in the background.
 */
export async function onAccountSignedIn(userId: string): Promise<SyncReport> {
  await ensureLocalStoresLoaded();
  const owner = await readAccountOwner();

  if (owner && owner !== 'guest' && owner !== userId) {
    // Another account's leftovers: never merge them into this one.
    await clearAccountBoundState();
    resetAccountStores();
  } else if (owner === 'guest') {
    await seedGuestFavorites();
  }

  const stash = await takeAccountStash(userId);
  if (stash) await restoreStash(stash);

  await writeAccountOwner(userId);
  // Same account as before: a normal start. Anything else (guest before,
  // fresh install, another account) is a sign-in: re-read server progress.
  return syncAccountState(owner === userId ? 'app_start' : 'sign_in');
}

/** Guests own the device's local state until they sign in. */
export async function onGuestSession(): Promise<void> {
  const owner = await readAccountOwner();
  if (owner === null) await writeAccountOwner('guest');
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function leaveAccount(userId: string, keepUnsynced: boolean): Promise<void> {
  if (keepUnsynced) await stashAccountState(userId);
  else await discardAccountStash(userId);
  // Files (journal photos) stay only while the stash still references them.
  await clearAccountBoundState({ keepFiles: keepUnsynced });
  await writeAccountOwner('guest');
  resetAccountStores();
}

export async function beforeSignOut(userId: string): Promise<void> {
  const report = await withTimeout(syncAccountState('sign_out'), SIGN_OUT_SYNC_TIMEOUT_MS, {
    ok: false,
    failedDomains: [],
    conflicts: 0,
  } as SyncReport);
  await leaveAccount(userId, !report.ok);
}

registerAccountHooks({
  beforeSignOut,
  // The account is gone - nothing to keep for it.
  afterAccountDeleted: (userId) => leaveAccount(userId, false),
  // No session left to sync with: keep unsynced state aside for this user.
  afterSessionLost: (userId) => leaveAccount(userId, true),
});
