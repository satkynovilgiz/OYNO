/**
 * Account-session generations: a response that arrives after its session
 * ended must change nothing - including when the SAME account signed in
 * again in the meantime ("A session #1" vs "A session #2").
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useProgressStore } from '@/store/useProgressStore';

import { bumpAccountGeneration, captureAccountGeneration, isAccountGenerationCurrent } from './accountGeneration';

type Deferred = { promise: Promise<void>; release: () => void };

const mockServer = {
  /** Per-account progress numbers the server returns. */
  xp: new Map<string, number>(),
  /** Requests made while this is set wait for it (captured per request). */
  hold: null as Deferred | null,
};

const mockAuth: { status: string; user: { id: string } | null } = { status: 'guest', user: null };

jest.mock('@/store/useAuthStore', () => ({ useAuthStore: { getState: () => mockAuth }, registerAccountHooks: jest.fn() }));
jest.mock('@/services/analytics/analytics', () => ({ track: jest.fn() }));

jest.mock('@/services/supabase/client', () => {
  const baseRow = {
    xp: 0, coins: 0, gems: 0, games_played: 0, games_won: 0, streak_days: 0, wins_today: 0, plays_today: 0,
    daily_challenge_claimed_date: null, daily_gift_claimed_date: null, daily_play_claimed_date: null, quiz_claimed_date: null,
    quest_found_count: 0, quest_completed: false, boz_uy_visited: false, culture_discovery_count: 0,
    oymo_created: false, shyrdak_created: false, komuz_lesson_completed: false,
  };
  function respond<T>(value: T): Promise<T> {
    const hold = mockServer.hold;
    return (hold ? hold.promise : Promise.resolve()).then(() => value);
  }
  return {
    supabase: {
      from: (table: string) => ({
        select: () => {
          // The answer is for the session that SENT the request.
          const userId = mockAuth.user?.id ?? 'nobody';
          const xp = mockServer.xp.get(userId) ?? 0;
          const data =
            table === 'user_progress'
              ? { ...baseRow, xp }
              : table === 'user_achievements'
                ? [{ achievement_id: `${userId}-achievement` }]
                : table === 'user_game_stats'
                  ? [{ game_id: `${userId}-game`, played: 1, won: 1 }]
                  : [];
          const result = { data, error: null };
          return { then: (ok: (value: unknown) => unknown, fail: (reason: unknown) => unknown) => respond(result).then(ok, fail), single: () => respond(result) };
        },
        insert: () => Promise.resolve({ data: null, error: null }),
      }),
      rpc: (fn: string) => {
        const userId = mockAuth.user?.id ?? 'nobody';
        if (fn === 'record_game_won') {
          return respond({ data: { progress: { ...baseRow, xp: 777, games_won: 99 }, newlyUnlocked: [`first-win`] }, error: null });
        }
        return respond({ data: { progress: { ...baseRow, xp: mockServer.xp.get(userId) ?? 0 } }, error: null });
      },
    },
  };
});

function deferred(): Deferred {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

function signIn(userId: string) {
  mockAuth.status = 'authenticated';
  mockAuth.user = { id: userId };
  bumpAccountGeneration(); // the auth store subscription does this in the app
}

function signOut() {
  bumpAccountGeneration(); // invalidateActiveSync() before cleanup
  mockAuth.status = 'guest';
  mockAuth.user = null;
}

function progressSnapshot() {
  const state = useProgressStore.getState();
  return { xp: state.xp, gamesWon: state.gamesWon, gameStats: state.gameStats, achievements: state.unlockedAchievementIds, modal: state.lastUnlockedAchievementId };
}

beforeEach(async () => {
  await AsyncStorage.clear();
  mockServer.xp.clear();
  mockServer.hold = null;
  mockAuth.status = 'guest';
  mockAuth.user = null;
  useProgressStore.setState({ xp: 0, gamesWon: 0, gameStats: {}, unlockedAchievementIds: [], lastUnlockedAchievementId: null, isLoaded: false, error: null });
});

describe('account generation', () => {
  it('distinguishes two sessions of the same account', () => {
    signIn('user-a');
    const first = captureAccountGeneration();
    signOut();
    signIn('user-a');
    const second = captureAccountGeneration();
    expect(first.userId).toBe(second.userId);
    expect(isAccountGenerationCurrent(first)).toBe(false);
    expect(isAccountGenerationCurrent(second)).toBe(true);
  });
});

describe('progress.load stale responses', () => {
  it("an old session's slow load is ignored after the SAME account signs in again", async () => {
    mockServer.xp.set('user-a', 10);
    signIn('user-a');
    mockServer.hold = deferred();
    const oldHold = mockServer.hold;
    const oldLoad = useProgressStore.getState().load();

    signOut();
    signIn('user-a');
    // New session establishes its own state (server now says 500).
    mockServer.hold = null;
    mockServer.xp.set('user-a', 500);
    await useProgressStore.getState().load();
    const cacheAfterNewSession = await AsyncStorage.getItem('oyno.progress.cache');
    expect(useProgressStore.getState().xp).toBe(500);

    oldHold.release();
    await oldLoad;

    expect(useProgressStore.getState().xp).toBe(500);
    // The stale response wrote nothing to the cache either.
    expect(await AsyncStorage.getItem('oyno.progress.cache')).toBe(cacheAfterNewSession);
  });

  it("Account A's slow load never lands in Account B's session", async () => {
    mockServer.xp.set('user-a', 10);
    signIn('user-a');
    mockServer.hold = deferred();
    const oldHold = mockServer.hold;
    const oldLoad = useProgressStore.getState().load();

    signOut();
    signIn('user-b');
    mockServer.hold = null;
    mockServer.xp.set('user-b', 3);
    await useProgressStore.getState().load();

    oldHold.release();
    await oldLoad;

    expect(useProgressStore.getState().xp).toBe(3);
    expect(useProgressStore.getState().unlockedAchievementIds).toEqual(['user-b-achievement']);
    expect(Object.keys(useProgressStore.getState().gameStats)).toEqual(['user-b-game']);
    expect(JSON.parse((await AsyncStorage.getItem('oyno.progress.cache'))!).ownerId).toBe('user-b');
  });

  it('a stale load writes no cache at all when nothing newer loaded', async () => {
    signIn('user-a');
    mockServer.hold = deferred();
    const oldHold = mockServer.hold;
    const oldLoad = useProgressStore.getState().load();
    signOut();
    oldHold.release();
    await oldLoad;
    expect(await AsyncStorage.getItem('oyno.progress.cache')).toBeNull();
    expect(useProgressStore.getState().isLoaded).toBe(false);
  });

  it('a current-session load still applies normally', async () => {
    mockServer.xp.set('user-a', 42);
    signIn('user-a');
    await useProgressStore.getState().load();
    expect(useProgressStore.getState().xp).toBe(42);
  });
});

describe('progress action (RPC) stale responses', () => {
  it("A's slow recordGameWon changes nothing for B: no stats, no achievement modal, no cache", async () => {
    signIn('user-a');
    mockServer.hold = deferred();
    const oldHold = mockServer.hold;
    const action = useProgressStore.getState().recordGameWon('ordo');

    signOut();
    signIn('user-b');
    const before = progressSnapshot();
    oldHold.release();
    await action;

    expect(progressSnapshot()).toEqual(before);
    expect(useProgressStore.getState().lastUnlockedAchievementId).toBeNull();
    expect(await AsyncStorage.getItem('oyno.progress.cache')).toBeNull();
  });

  it("A's old-session action changes nothing in A's new session", async () => {
    signIn('user-a');
    mockServer.hold = deferred();
    const oldHold = mockServer.hold;
    const action = useProgressStore.getState().recordGameWon('ordo');

    signOut();
    signIn('user-a');
    const before = progressSnapshot();
    oldHold.release();
    await action;

    expect(progressSnapshot()).toEqual(before);
    expect(await AsyncStorage.getItem('oyno.progress.cache')).toBeNull();
  });

  it('a current-session action still applies (stats, achievement, cache)', async () => {
    signIn('user-a');
    await useProgressStore.getState().recordGameWon('ordo');
    const state = useProgressStore.getState();
    expect(state.xp).toBe(777);
    expect(state.gameStats.ordo).toEqual({ played: 0, won: 1 });
    expect(state.lastUnlockedAchievementId).toBe('first-win');
    expect(JSON.parse((await AsyncStorage.getItem('oyno.progress.cache'))!).ownerId).toBe('user-a');
  });
});
