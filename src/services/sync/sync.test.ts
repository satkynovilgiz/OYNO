/**
 * Cross-device sync, end to end against an in-memory fake of the Supabase
 * tables/RPCs it uses (there's no way to run a real backend here - see
 * migrationSecurity.test.ts). The fake mirrors the SQL merge rules in
 * 20260923000001_account_sync.sql so these tests exercise the real client
 * flow: stores -> outbox -> sync engine -> "server" -> stores.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onlineManager } from '@tanstack/react-query';

import { track } from '@/services/analytics/analytics';
import { useChallengeStore } from '@/store/useChallengeStore';
import { useDailyDiscoveryStore } from '@/store/useDailyDiscoveryStore';
import { useFavoritesStore } from '@/store/useFavoritesStore';
import { useJournalStore } from '@/store/useJournalStore';
import { useProgressStore } from '@/store/useProgressStore';
import { useWallpaperFavoritesStore } from '@/store/useWallpaperFavoritesStore';

import { ACCOUNT_OWNER_KEY, readAccountOwner } from './accountScope';
import { beforeSignOut, onAccountSignedIn } from './accountLifecycle';
import { mergeChallengeResult, mergeFavorites } from './mergeRules';
import { readPendingFavorites, readPendingVisits } from './outbox';
import { __resetSyncEngineForTests, syncAccountState } from './syncEngine';

// ---------------------------------------------------------------------
// Fake account backend (per user id)
// ---------------------------------------------------------------------

type ChallengeRow = {
  challenge_key: string;
  best_correct: number;
  last_correct: number;
  last_total: number;
  attempts: number;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
};

type Account = {
  visits: Map<string, string>;
  daily: Map<string, string>;
  challenges: Map<string, ChallengeRow>;
  favorites: Map<string, string>;
  journal: Map<string, Record<string, unknown>>;
};

const mockBackend = {
  accounts: new Map<string, Account>(),
  knownRegions: new Set(['son-kol', 'ala-too', 'suusamyr', 'alay', 'sary-chelek', 'arslanbob']),
  failTables: new Set<string>(),
  writes: [] as string[],
  account(userId: string): Account {
    if (!this.accounts.has(userId)) this.accounts.set(userId, { visits: new Map(), daily: new Map(), challenges: new Map(), favorites: new Map(), journal: new Map() });
    return this.accounts.get(userId)!;
  },
};

const mockAuth: { status: string; user: { id: string } | null } = { status: 'guest', user: null };

function mockCurrent(): Account {
  if (!mockAuth.user) throw new Error('no session');
  return mockBackend.account(mockAuth.user.id);
}

jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: { getState: () => mockAuth },
  registerAccountHooks: jest.fn(),
}));

jest.mock('@/services/analytics/analytics', () => ({ track: jest.fn() }));

jest.mock('@/services/supabase/client', () => {
  const result = (data: unknown, error: unknown = null) => ({ data, error });
  const progressRow = {
    xp: 0, coins: 0, gems: 0, games_played: 0, games_won: 0, streak_days: 0, wins_today: 0, plays_today: 0,
    daily_challenge_claimed_date: null, daily_gift_claimed_date: null, daily_play_claimed_date: null, quiz_claimed_date: null,
    quest_found_count: 0, quest_completed: false, boz_uy_visited: false, culture_discovery_count: 0,
    oymo_created: false, shyrdak_created: false, komuz_lesson_completed: false,
  };
  function rows(table: string) {
    if (mockBackend.failTables.has(table)) return result(null, { code: 'PGRST205', message: `relation ${table} does not exist` });
    const account = mockCurrent();
    switch (table) {
      case 'user_region_visits':
        return result([...account.visits].map(([region_id, visited_at]) => ({ region_id, visited_at })));
      case 'user_daily_completions':
        return result([...account.daily].map(([date_key, item_id]) => ({ date_key, item_id })));
      case 'user_challenge_results':
        return result([...account.challenges.values()]);
      case 'user_favorites':
        return result([...account.favorites].map(([key, created_at]) => ({ target_type: key.split(':')[0], target_id: key.slice(key.indexOf(':') + 1), created_at })));
      case 'user_progress':
        return result(progressRow);
      case 'user_journal_entries':
        return result([...account.journal.values()]);
      default:
        return result([]);
    }
  }
  return {
    supabase: {
      from: (table: string) => ({
        select: () => {
          const response = rows(table);
          return { then: (resolve: (value: unknown) => unknown) => Promise.resolve(response).then(resolve), single: () => Promise.resolve(response) };
        },
        insert: () => Promise.resolve(result(null)),
      }),
      rpc: (fn: string, args: Record<string, unknown>) => {
        const account = mockCurrent();
        mockBackend.writes.push(fn);
        const now = new Date().toISOString();
        if (fn === 'visit_explore_region') {
          const id = args.p_region_id as string;
          if (!mockBackend.knownRegions.has(id)) return Promise.resolve(result(null, { message: 'UNKNOWN_REGION' }));
          if (!account.visits.has(id)) account.visits.set(id, now);
          return Promise.resolve(result(null));
        }
        if (fn === 'merge_daily_completions') {
          if (mockBackend.failTables.has('user_daily_completions')) return Promise.resolve(result(null, { code: 'PGRST202', message: 'missing' }));
          for (const item of args.p_items as { date_key: string; item_id: string }[]) if (!account.daily.has(item.date_key)) account.daily.set(item.date_key, item.item_id);
          return Promise.resolve(result([...account.daily].map(([date_key, item_id]) => ({ date_key, item_id }))));
        }
        if (fn === 'merge_challenge_results') {
          for (const item of args.p_items as ChallengeRow[]) {
            const existing = account.challenges.get(item.challenge_key);
            if (!existing) account.challenges.set(item.challenge_key, { ...item });
            else {
              const newer = item.updated_at > existing.updated_at;
              account.challenges.set(item.challenge_key, {
                ...existing,
                best_correct: Math.max(existing.best_correct, item.best_correct),
                attempts: Math.max(existing.attempts, item.attempts),
                completed_at: [existing.completed_at, item.completed_at].filter(Boolean).sort()[0] ?? null,
                last_correct: newer ? item.last_correct : existing.last_correct,
                last_total: newer ? item.last_total : existing.last_total,
                updated_at: newer ? item.updated_at : existing.updated_at,
              });
            }
          }
          return Promise.resolve(result([...account.challenges.values()]));
        }
        if (fn === 'merge_journal_entries') {
          for (const item of args.p_items as Record<string, unknown>[]) {
            const existing = account.journal.get(item.id as string);
            if (!existing || (item.updated_at as string) > (existing.updated_at as string)) account.journal.set(item.id as string, { ...item });
          }
          return Promise.resolve(result([...account.journal.values()]));
        }
        if (fn === 'toggle_favorite') {
          const key = `${args.p_target_type as string}:${args.p_target_id as string}`;
          if (account.favorites.has(key)) {
            account.favorites.delete(key);
            return Promise.resolve(result(false));
          }
          account.favorites.set(key, now);
          return Promise.resolve(result(true));
        }
        return Promise.resolve(result(null));
      },
    },
  };
});

const mockTrack = track as jest.Mock;

function signInAs(userId: string) {
  mockAuth.status = 'authenticated';
  mockAuth.user = { id: userId };
}

function becomeGuest() {
  mockAuth.status = 'guest';
  mockAuth.user = null;
}

async function resetDevice() {
  await AsyncStorage.clear();
  useDailyDiscoveryStore.setState({ completions: {}, isLoaded: false });
  useChallengeStore.setState({ daily: null, results: {}, isLoaded: false });
  useFavoritesStore.setState({ favoriteIds: [], isLoaded: false });
  useWallpaperFavoritesStore.setState({ ids: [], isLoaded: false });
  useProgressStore.setState({ visitedRegionIds: [], regionVisitDates: {}, isLoaded: false });
  useJournalStore.setState({ entries: [], isLoaded: false });
}

const WRITE_RPCS = ['visit_explore_region', 'merge_daily_completions', 'merge_challenge_results', 'toggle_favorite'];

beforeEach(async () => {
  mockBackend.accounts.clear();
  mockBackend.failTables.clear();
  mockBackend.writes = [];
  mockTrack.mockClear();
  onlineManager.setOnline(true);
  __resetSyncEngineForTests();
  becomeGuest();
  await resetDevice();
});

afterAll(() => {
  __resetSyncEngineForTests();
});

describe('fresh-device restore', () => {
  it('hydrates every account-backed store from the server so Passport/Journey/Map agree', async () => {
    const account = mockBackend.account('user-a');
    account.visits.set('son-kol', '2026-09-01T10:00:00.000Z');
    account.daily.set('2026-09-20', 'komuz-overview');
    account.challenges.set('journey', { challenge_key: 'journey', best_correct: 4, last_correct: 4, last_total: 5, attempts: 2, started_at: '2026-09-02T00:00:00.000Z', completed_at: '2026-09-02T00:05:00.000Z', updated_at: '2026-09-02T00:05:00.000Z' });
    account.favorites.set('nature:son-kol', '2026-09-03T00:00:00.000Z');
    account.favorites.set('wallpaper:ala-too', '2026-09-03T00:00:00.000Z');

    signInAs('user-a');
    const report = await onAccountSignedIn('user-a');

    expect(report.ok).toBe(true);
    expect(useProgressStore.getState().visitedRegionIds).toEqual(['son-kol']);
    expect(useProgressStore.getState().regionVisitDates['son-kol']).toBe('2026-09-01T10:00:00.000Z');
    expect(useDailyDiscoveryStore.getState().completions).toEqual({ '2026-09-20': 'komuz-overview' });
    expect(useChallengeStore.getState().results.journey.bestCorrect).toBe(4);
    expect(useFavoritesStore.getState().favoriteIds).toEqual(['nature:son-kol']);
    expect(useWallpaperFavoritesStore.getState().ids).toEqual(['ala-too']);
    // Restoring is read-only: nothing is written back.
    expect(mockBackend.writes.filter((fn) => WRITE_RPCS.includes(fn))).toEqual([]);
    expect(await readAccountOwner()).toBe('user-a');
  });
});

describe('guest -> signed-in merge', () => {
  it('keeps everything the guest did and merges it into the account', async () => {
    await AsyncStorage.setItem(ACCOUNT_OWNER_KEY, 'guest');
    await useProgressStore.getState().load();
    await useProgressStore.getState().visitExploreRegion('suusamyr');
    await useDailyDiscoveryStore.getState().load();
    await useDailyDiscoveryStore.getState().complete('2026-09-22', 'oymo-overview');
    await useChallengeStore.getState().load();
    useChallengeStore.getState().complete('collection:horse-culture', 6, 8);
    await useFavoritesStore.getState().load();
    await useFavoritesStore.getState().toggleFavorite('game', 'ordo');

    // The guest sees their own visit before signing in.
    expect(useProgressStore.getState().visitedRegionIds).toEqual(['suusamyr']);

    const account = mockBackend.account('user-a');
    account.visits.set('son-kol', '2026-09-01T10:00:00.000Z');
    account.favorites.set('nature:alay', '2026-09-01T00:00:00.000Z');

    signInAs('user-a');
    const report = await onAccountSignedIn('user-a');

    expect(report.ok).toBe(true);
    expect([...account.visits.keys()].sort()).toEqual(['son-kol', 'suusamyr']);
    expect(account.daily.get('2026-09-22')).toBe('oymo-overview');
    expect(account.challenges.get('collection:horse-culture')?.best_correct).toBe(6);
    expect([...account.favorites.keys()].sort()).toEqual(['game:ordo', 'nature:alay']);

    expect([...useProgressStore.getState().visitedRegionIds].sort()).toEqual(['son-kol', 'suusamyr']);
    expect(useDailyDiscoveryStore.getState().completions['2026-09-22']).toBe('oymo-overview');
    expect(useFavoritesStore.getState().favoriteIds.sort()).toEqual(['game:ordo', 'nature:alay']);
    expect(await readPendingVisits()).toEqual({});
    expect(await readPendingFavorites()).toEqual({});
  });

  it('a guest un-favorite never removes an account favorite', () => {
    const { desired, toRemove } = mergeFavorites([{ key: 'game:ordo', createdAt: '2026-09-01T00:00:00.000Z' }], {
      'game:ordo': { favorited: false, at: '2026-09-10T00:00:00.000Z', origin: 'guest' },
    });
    expect(desired).toEqual(['game:ordo']);
    expect(toRemove).toEqual([]);
  });
});

describe('offline changes then reconnect', () => {
  it('keeps offline edits locally, then sends them once when the connection returns', async () => {
    signInAs('user-a');
    await onAccountSignedIn('user-a');
    mockBackend.writes = [];

    onlineManager.setOnline(false);
    await useProgressStore.getState().visitExploreRegion('alay');
    await useDailyDiscoveryStore.getState().complete('2026-09-23', 'komuz-overview');
    await useFavoritesStore.getState().toggleFavorite('culture_item', 'boz-uy-tunduk');
    const offlineReport = await syncAccountState('local_change');

    expect(offlineReport.skipped).toBe('offline');
    expect(mockBackend.writes).toEqual([]);
    // Still visible on the device while offline.
    expect(useProgressStore.getState().visitedRegionIds).toContain('alay');
    expect(useFavoritesStore.getState().favoriteIds).toContain('culture_item:boz-uy-tunduk');
    expect(Object.keys(await readPendingVisits())).toEqual(['alay']);

    onlineManager.setOnline(true);
    const report = await syncAccountState('reconnect');

    expect(report.ok).toBe(true);
    const account = mockBackend.account('user-a');
    expect(account.visits.has('alay')).toBe(true);
    expect(account.daily.get('2026-09-23')).toBe('komuz-overview');
    expect(account.favorites.has('culture_item:boz-uy-tunduk')).toBe(true);
    expect(await readPendingVisits()).toEqual({});
    expect(await readPendingFavorites()).toEqual({});
  });
});

describe('duplicate write prevention', () => {
  it('a second sync with nothing new writes nothing', async () => {
    signInAs('user-a');
    await onAccountSignedIn('user-a');
    await useProgressStore.getState().visitExploreRegion('son-kol');
    await useDailyDiscoveryStore.getState().complete('2026-09-23', 'komuz-overview');
    useChallengeStore.getState().complete('journey', 3, 5);
    await useFavoritesStore.getState().toggleFavorite('game', 'ordo');
    await syncAccountState('local_change');

    const writesAfterFirst = mockBackend.writes.filter((fn) => WRITE_RPCS.includes(fn));
    expect(writesAfterFirst.sort()).toEqual(['merge_challenge_results', 'merge_daily_completions', 'toggle_favorite', 'visit_explore_region']);

    mockBackend.writes = [];
    await syncAccountState('foreground');
    await syncAccountState('foreground');
    expect(mockBackend.writes.filter((fn) => WRITE_RPCS.includes(fn))).toEqual([]);
  });

  it('re-visiting a place never queues or sends it again', async () => {
    signInAs('user-a');
    await onAccountSignedIn('user-a');
    await useProgressStore.getState().visitExploreRegion('son-kol');
    await syncAccountState('local_change');
    mockBackend.writes = [];
    await useProgressStore.getState().visitExploreRegion('son-kol');
    await syncAccountState('local_change');
    expect(mockBackend.writes.filter((fn) => fn === 'visit_explore_region')).toEqual([]);
  });
});

describe('completed-state merge', () => {
  it('completed wins: server days are never dropped, local-only days are added', async () => {
    const account = mockBackend.account('user-a');
    account.daily.set('2026-09-20', 'server-item');
    await useDailyDiscoveryStore.getState().load();
    await useDailyDiscoveryStore.getState().complete('2026-09-20', 'local-item');
    await useDailyDiscoveryStore.getState().complete('2026-09-21', 'local-only');

    signInAs('user-a');
    const report = await onAccountSignedIn('user-a');

    expect(useDailyDiscoveryStore.getState().completions).toEqual({ '2026-09-20': 'server-item', '2026-09-21': 'local-only' });
    expect(account.daily.get('2026-09-21')).toBe('local-only');
    expect(report.conflicts).toBeGreaterThan(0);
    expect(mockTrack).toHaveBeenCalledWith('sync_conflict_merged', expect.objectContaining({ count: expect.any(Number) }));
  });

  it('a challenge finished on either device stays finished', () => {
    const started = { startedAt: '2026-09-01T00:00:00.000Z', completedAt: null, lastCorrect: 0, lastTotal: 0, bestCorrect: 0, attempts: 0, updatedAt: '2026-09-05T00:00:00.000Z' };
    const finished = { startedAt: '2026-09-02T00:00:00.000Z', completedAt: '2026-09-02T00:03:00.000Z', lastCorrect: 4, lastTotal: 5, bestCorrect: 4, attempts: 1, updatedAt: '2026-09-02T00:03:00.000Z' };
    const merged = mergeChallengeResult(started, finished)!;
    expect(merged.completedAt).toBe('2026-09-02T00:03:00.000Z');
    expect(merged.startedAt).toBe('2026-09-01T00:00:00.000Z');
    expect(merged.bestCorrect).toBe(4);
  });
});

describe('best-score merge', () => {
  it('keeps the highest score while "last result" follows the newest attempt', async () => {
    const account = mockBackend.account('user-a');
    account.challenges.set('journey', { challenge_key: 'journey', best_correct: 5, last_correct: 5, last_total: 5, attempts: 3, started_at: '2026-09-01T00:00:00.000Z', completed_at: '2026-09-01T00:05:00.000Z', updated_at: '2026-09-01T00:05:00.000Z' });
    await useChallengeStore.getState().load();
    useChallengeStore.getState().complete('journey', 2, 5); // newer, lower

    signInAs('user-a');
    await onAccountSignedIn('user-a');

    const local = useChallengeStore.getState().results.journey;
    expect(local.bestCorrect).toBe(5);
    expect(local.lastCorrect).toBe(2);
    expect(account.challenges.get('journey')?.best_correct).toBe(5);
    expect(account.challenges.get('journey')?.last_correct).toBe(2);
  });

  it('never lowers a best score, whichever side is newer', () => {
    const high = { startedAt: 'a', completedAt: '2026-09-01', lastCorrect: 7, lastTotal: 8, bestCorrect: 7, attempts: 2, updatedAt: '2026-09-01' };
    const low = { startedAt: 'a', completedAt: '2026-09-02', lastCorrect: 1, lastTotal: 8, bestCorrect: 1, attempts: 3, updatedAt: '2026-09-02' };
    expect(mergeChallengeResult(high, low)!.bestCorrect).toBe(7);
    expect(mergeChallengeResult(low, high)!.bestCorrect).toBe(7);
    expect(mergeChallengeResult(low, high)!.attempts).toBe(3);
  });
});

describe('sign-out isolation', () => {
  async function signedInWithData(userId: string) {
    signInAs(userId);
    await onAccountSignedIn(userId);
    await useProgressStore.getState().visitExploreRegion('son-kol');
    await useDailyDiscoveryStore.getState().complete('2026-09-23', 'komuz-overview');
    useChallengeStore.getState().complete('journey', 4, 5);
    await useFavoritesStore.getState().toggleFavorite('game', 'ordo');
  }

  it('clears the account from the device, keeps it on the server, and the next user sees none of it', async () => {
    await signedInWithData('user-a');
    await beforeSignOut('user-a');
    becomeGuest();
    await useProgressStore.getState().load();

    // Server progress is untouched.
    const account = mockBackend.account('user-a');
    expect(account.visits.has('son-kol')).toBe(true);
    expect(account.daily.has('2026-09-23')).toBe(true);
    expect(account.favorites.has('game:ordo')).toBe(true);

    // The device shows nothing of user-a.
    expect(await readAccountOwner()).toBe('guest');
    expect(useProgressStore.getState().visitedRegionIds).toEqual([]);
    expect(useDailyDiscoveryStore.getState().completions).toEqual({});
    expect(useChallengeStore.getState().results).toEqual({});
    expect(useFavoritesStore.getState().favoriteIds).toEqual([]);
    expect(await AsyncStorage.getItem('oyno.progress.cache')).toBeNull();
    expect(await AsyncStorage.getItem('oyno.favorites.cache')).toBeNull();

    // Another account on the same device starts from its own data only.
    signInAs('user-b');
    await useProgressStore.getState().load();
    await onAccountSignedIn('user-b');
    expect(useProgressStore.getState().visitedRegionIds).toEqual([]);
    expect(useFavoritesStore.getState().favoriteIds).toEqual([]);
    expect(mockBackend.account('user-b').favorites.size).toBe(0);
  });

  it('an offline sign-out keeps unsynced progress for that account only', async () => {
    await signedInWithData('user-a');
    // Let the edits above settle, then go offline and make one more.
    await syncAccountState('local_change');
    onlineManager.setOnline(false);
    await useDailyDiscoveryStore.getState().complete('2026-09-24', 'offline-day');
    await beforeSignOut('user-a');
    becomeGuest();
    expect(useDailyDiscoveryStore.getState().completions).toEqual({});

    onlineManager.setOnline(true);
    signInAs('user-b');
    await onAccountSignedIn('user-b');
    expect(useDailyDiscoveryStore.getState().completions['2026-09-24']).toBeUndefined();
    expect(mockBackend.account('user-b').daily.has('2026-09-24')).toBe(false);
    await beforeSignOut('user-b');

    signInAs('user-a');
    await onAccountSignedIn('user-a');
    expect(useDailyDiscoveryStore.getState().completions['2026-09-24']).toBe('offline-day');
    expect(mockBackend.account('user-a').daily.get('2026-09-24')).toBe('offline-day');
  });

  it("never merges another account's leftovers into a new sign-in", async () => {
    await AsyncStorage.setItem(ACCOUNT_OWNER_KEY, 'user-a');
    await AsyncStorage.setItem('oyno.daily.completions', JSON.stringify({ '2026-09-01': 'a-private' }));
    await useDailyDiscoveryStore.getState().load();

    signInAs('user-b');
    await onAccountSignedIn('user-b');

    expect(useDailyDiscoveryStore.getState().completions).toEqual({});
    expect(mockBackend.account('user-b').daily.size).toBe(0);
  });
});

describe('partial server failure', () => {
  it('one failing domain keeps its local data and does not block the others', async () => {
    mockBackend.failTables.add('user_challenge_results');
    signInAs('user-a');
    await onAccountSignedIn('user-a');
    useChallengeStore.getState().complete('journey', 3, 5);
    await useDailyDiscoveryStore.getState().complete('2026-09-23', 'komuz-overview');
    await useFavoritesStore.getState().toggleFavorite('game', 'ordo');

    const report = await syncAccountState('local_change');

    expect(report.ok).toBe(false);
    expect(report.failedDomains).toEqual(['challenges']);
    expect(useChallengeStore.getState().results.journey.bestCorrect).toBe(3);
    const account = mockBackend.account('user-a');
    expect(account.daily.has('2026-09-23')).toBe(true);
    expect(account.favorites.has('game:ordo')).toBe(true);

    // Once the table exists (migration applied), the result goes up.
    mockBackend.failTables.clear();
    const retry = await syncAccountState('foreground');
    expect(retry.ok).toBe(true);
    expect(account.challenges.get('journey')?.best_correct).toBe(3);
  });

  it('sync events carry only safe, content-free properties', async () => {
    mockBackend.failTables.add('user_daily_completions');
    signInAs('user-a');
    await onAccountSignedIn('user-a');
    await useDailyDiscoveryStore.getState().complete('2026-09-23', 'komuz-overview');
    await syncAccountState('local_change');

    const syncEvents = mockTrack.mock.calls.filter(([name]) => String(name).startsWith('sync_'));
    expect(syncEvents.map(([name]) => name)).toEqual(expect.arrayContaining(['sync_started', 'sync_failed', 'sync_completed']));
    for (const [, properties] of syncEvents) {
      for (const [key, value] of Object.entries(properties as Record<string, unknown>)) {
        expect(['reason', 'domain', 'code', 'ok', 'failed', 'ms', 'count']).toContain(key);
        expect(String(value)).not.toMatch(/@|user-a|komuz|does not exist/);
      }
    }
  });
});

describe('private journal sync', () => {
  const draft = { title: 'Son-Köl at dawn', note: 'private words', date: '2026-09-20', photoUri: null, link: { type: 'nature_site' as const, id: 'son-kol', label: 'Son-Köl' } };

  it("merges a guest's journal into the account on sign-in, and restores it on a fresh device", async () => {
    await AsyncStorage.setItem(ACCOUNT_OWNER_KEY, 'guest');
    await useJournalStore.getState().load();
    const entry = (await useJournalStore.getState().create(draft))!;

    signInAs('user-a');
    await onAccountSignedIn('user-a');
    const account = mockBackend.account('user-a');
    expect(account.journal.get(entry.id)).toMatchObject({ title: 'Son-Köl at dawn', note: 'private words', link_id: 'son-kol' });

    // Sign out: the journal leaves the device, stays in the account.
    await beforeSignOut('user-a');
    becomeGuest();
    expect(useJournalStore.getState().entries).toEqual([]);
    expect(await AsyncStorage.getItem('oyno.journal.v1')).toBeNull();

    // Fresh device, same account.
    await resetDevice();
    signInAs('user-a');
    await onAccountSignedIn('user-a');
    expect(useJournalStore.getState().entries.map((item) => item.title)).toEqual(['Son-Köl at dawn']);
  });

  it('a deletion on one phone reaches the account instead of reappearing', async () => {
    signInAs('user-a');
    await onAccountSignedIn('user-a');
    const entry = (await useJournalStore.getState().create(draft))!;
    await syncAccountState('local_change');
    await useJournalStore.getState().remove(entry.id);
    await syncAccountState('local_change');
    expect(mockBackend.account('user-a').journal.get(entry.id)).toMatchObject({ note: '', deleted_at: expect.any(String) });
  });

  it('journal text never appears in sync analytics', async () => {
    signInAs('user-a');
    await onAccountSignedIn('user-a');
    await useJournalStore.getState().create(draft);
    await syncAccountState('local_change');
    expect(JSON.stringify(mockTrack.mock.calls)).not.toMatch(/private words|Son-Köl at dawn/);
  });
});
