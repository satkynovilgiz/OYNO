/**
 * Mocks the Supabase client and auth store rather than hitting a real
 * backend - there's no way to run one in this test environment (see
 * migrationSecurity.test.ts's own note on why). This still exercises real
 * client-side logic that has nothing to do with the network itself: the
 * EXPECTED_REJECTIONS filter (an "already claimed" rejection must not
 * surface as a user-facing error, an unexpected one must), the
 * discovered-id dedup guard, and claimDailyQuiz reading the server's
 * explicit `rewarded` flag rather than inferring it from a coin delta.
 */
import { supabase } from '@/services/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';

import { useProgressStore } from './useProgressStore';

jest.mock('@/services/supabase/client', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(() => ({
      insert: jest.fn(() => Promise.resolve({ error: null })),
    })),
  },
}));

jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: { getState: jest.fn() },
}));

const mockRpc = supabase.rpc as jest.Mock;
const mockAuthState = useAuthStore.getState as jest.Mock;

const BASE_ROW = {
  xp: 0,
  coins: 0,
  gems: 0,
  games_played: 0,
  games_won: 0,
  streak_days: 0,
  wins_today: 0,
  plays_today: 0,
  daily_challenge_claimed_date: null,
  daily_gift_claimed_date: null,
  daily_play_claimed_date: null,
  quiz_claimed_date: null,
  quest_found_count: 0,
  quest_completed: false,
  boz_uy_visited: false,
  culture_discovery_count: 0,
};

function resetStore() {
  useProgressStore.setState({
    ...useProgressStore.getState(),
    error: null,
    coins: 0,
    xp: 0,
    discoveredExploreIds: [],
    unlockedAchievementIds: [],
    gameStats: {},
  });
}

beforeEach(() => {
  mockRpc.mockReset();
  mockAuthState.mockReturnValue({ status: 'authenticated', user: { id: 'user-1' } });
  resetStore();
});

describe('useProgressStore', () => {
  it('does not surface an ALREADY_CLAIMED rejection as a user-facing error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'ALREADY_CLAIMED' } });

    const result = await useProgressStore.getState().claimDailyGift();

    expect(result).toBe(false);
    expect(useProgressStore.getState().error).toBeNull();
  });

  it('surfaces a genuinely unexpected RPC error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'connection reset' } });

    const result = await useProgressStore.getState().claimDailyGift();

    expect(result).toBe(false);
    expect(useProgressStore.getState().error).toBe('connection reset');
  });

  it('applies a successful claim and clears any prior error', async () => {
    useProgressStore.setState({ error: 'stale error from a previous failed call' });
    mockRpc.mockResolvedValue({ data: { progress: { ...BASE_ROW, coins: 30, xp: 20 } }, error: null });

    const result = await useProgressStore.getState().claimDailyGift();

    expect(result).toBe(true);
    expect(useProgressStore.getState().coins).toBe(30);
    expect(useProgressStore.getState().xp).toBe(20);
    expect(useProgressStore.getState().error).toBeNull();
  });

  it('does not call the RPC at all for a guest (no session to attach progress to)', async () => {
    mockAuthState.mockReturnValue({ status: 'guest', user: null });

    const result = await useProgressStore.getState().claimDailyGift();

    expect(mockRpc).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });

  it('discoverExploreItem only appends a new id once, even if the server is called again for an already-discovered item', async () => {
    mockRpc.mockResolvedValue({ data: { progress: BASE_ROW }, error: null });
    useProgressStore.setState({ discoveredExploreIds: ['boz-uy'] });

    await useProgressStore.getState().discoverExploreItem('boz-uy');

    expect(useProgressStore.getState().discoveredExploreIds).toEqual(['boz-uy']);
  });

  it('discoverExploreItem appends a genuinely new id', async () => {
    mockRpc.mockResolvedValue({ data: { progress: BASE_ROW }, error: null });

    await useProgressStore.getState().discoverExploreItem('too-teke');

    expect(useProgressStore.getState().discoveredExploreIds).toEqual(['too-teke']);
  });

  it('recordGameWon merges newly-unlocked achievements without duplicating already-known ones', async () => {
    useProgressStore.setState({ unlockedAchievementIds: ['first-win'] });
    mockRpc.mockResolvedValue({
      data: { progress: { ...BASE_ROW, games_won: 2 }, newlyUnlocked: ['first-win', 'traveler'] },
      error: null,
    });

    await useProgressStore.getState().recordGameWon('besh-tash');

    const state = useProgressStore.getState();
    expect(state.unlockedAchievementIds).toEqual(['first-win', 'traveler']);
    expect(state.lastUnlockedAchievementId).toBe('traveler');
    expect(state.gameStats['besh-tash']).toEqual({ played: 0, won: 1 });
  });

  it('claimDailyQuiz trusts the server-reported `rewarded` flag, not a coin-delta guess', async () => {
    // Coins go up (a coincidental unrelated change in the same response
    // shape) but the server explicitly says this attempt wasn't rewarded -
    // the store must report exactly that, not infer "rewarded" from the
    // coin delta being non-zero.
    mockRpc.mockResolvedValue({
      data: { progress: { ...BASE_ROW, coins: 999 }, correct: 3, total: 8, rewarded: false },
      error: null,
    });

    const result = await useProgressStore.getState().claimDailyQuiz([{ question_id: 'q1', choice_index: 0 }]);

    expect(result).toEqual({ correct: 3, total: 8, rewarded: false });
  });
});
