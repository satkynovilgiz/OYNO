import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { getNewlyUnlockedAchievements } from '@/services/progress/achievements';
import type { AchievementId } from '@/services/progress/types';

const STORAGE_KEY = 'oyno.progress';

export const DAILY_CHALLENGE_REWARD = { xp: 100, coins: 50 };
export const DAILY_GIFT_REWARD = { xp: 20, coins: 30 };
export const DAILY_PLAY_GOAL = 3;
export const DAILY_PLAY_REWARD = { xp: 30, coins: 20 };
export const QUEST_REWARD = { xp: 80, coins: 40 };
export const BOZ_UY_REWARD = { xp: 15, coins: 0 };
export const CULTURE_DISCOVERY_REWARD = { xp: 15, coins: 0 };

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((new Date(toISO).getTime() - new Date(fromISO).getTime()) / 86400000);
}

export type GameStat = { played: number; won: number };

type PersistedShape = {
  xp: number;
  coins: number;
  gems: number;
  gamesPlayed: number;
  gamesWon: number;
  gameStats: Record<string, GameStat>;
  streakDays: number;
  lastActiveDateISO: string | null;
  winsToday: number;
  playsToday: number;
  dailyCountersDateISO: string | null;
  dailyChallengeClaimedDateISO: string | null;
  dailyGiftClaimedDateISO: string | null;
  dailyPlayClaimedDateISO: string | null;
  questFoundCount: number;
  questCompleted: boolean;
  bozUyVisited: boolean;
  cultureDiscoveryCount: number;
  discoveredExploreIds: string[];
  unlockedAchievementIds: AchievementId[];
};

const DEFAULT_STATE: PersistedShape = {
  xp: 0,
  coins: 0,
  gems: 0,
  gamesPlayed: 0,
  gamesWon: 0,
  gameStats: {},
  streakDays: 0,
  lastActiveDateISO: null,
  winsToday: 0,
  playsToday: 0,
  dailyCountersDateISO: null,
  dailyChallengeClaimedDateISO: null,
  dailyGiftClaimedDateISO: null,
  dailyPlayClaimedDateISO: null,
  questFoundCount: 0,
  questCompleted: false,
  bozUyVisited: false,
  cultureDiscoveryCount: 0,
  discoveredExploreIds: [],
  unlockedAchievementIds: [],
};

async function persist(state: PersistedShape) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function ensureDailyReset(state: PersistedShape): PersistedShape {
  const today = todayISO();
  if (state.dailyCountersDateISO === today) return state;
  return { ...state, winsToday: 0, playsToday: 0, dailyCountersDateISO: today };
}

function applyStreak(state: PersistedShape): PersistedShape {
  const today = todayISO();
  if (state.lastActiveDateISO === today) return state;
  const streakDays = !state.lastActiveDateISO
    ? 1
    : daysBetween(state.lastActiveDateISO, today) === 1
      ? state.streakDays + 1
      : 1;
  return { ...state, streakDays, lastActiveDateISO: today };
}

function withDaily(state: PersistedShape): PersistedShape {
  return applyStreak(ensureDailyReset(state));
}

function withAchievementCheck(state: PersistedShape): { next: PersistedShape; lastUnlocked: AchievementId | null } {
  const newly = getNewlyUnlockedAchievements(
    {
      gamesWon: state.gamesWon,
      questCompletedCount: state.questCompleted ? 1 : 0,
      bozUyVisited: state.bozUyVisited,
      cultureDiscoveryCount: state.cultureDiscoveryCount,
    },
    state.unlockedAchievementIds,
  );
  if (newly.length === 0) return { next: state, lastUnlocked: null };
  return {
    next: { ...state, unlockedAchievementIds: [...state.unlockedAchievementIds, ...newly] },
    lastUnlocked: newly[newly.length - 1],
  };
}

function addReward(state: PersistedShape, reward: { xp: number; coins: number }): PersistedShape {
  return { ...state, xp: state.xp + reward.xp, coins: state.coins + reward.coins };
}

type ProgressState = PersistedShape & {
  isLoaded: boolean;
  lastUnlockedAchievementId: AchievementId | null;
  load: () => Promise<void>;
  recordGamePlayed: (gameId: string) => void;
  recordGameWon: (gameId: string) => void;
  advanceQuest: () => void;
  discoverExploreItem: (id: string, xpReward: number) => boolean;
  visitBozUy: () => void;
  discoverCulture: () => void;
  claimDailyChallenge: () => boolean;
  claimDailyGift: () => boolean;
  claimDailyPlay: () => boolean;
  acknowledgeAchievement: () => void;
};

export const useProgressStore = create<ProgressState>((set, get) => {
  function commit(next: PersistedShape) {
    const { next: checked, lastUnlocked } = withAchievementCheck(next);
    set({
      ...checked,
      isLoaded: true,
      lastUnlockedAchievementId: lastUnlocked ?? get().lastUnlockedAchievementId,
    });
    void persist(checked);
  }

  return {
    ...DEFAULT_STATE,
    isLoaded: false,
    lastUnlockedAchievementId: null,

    load: async () => {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      const merged = withDaily({ ...DEFAULT_STATE, ...parsed, gameStats: { ...parsed.gameStats } });
      set({ ...merged, isLoaded: true, lastUnlockedAchievementId: null });
      void persist(merged);
    },

    recordGamePlayed: (gameId) => {
      const current = withDaily(get());
      const stat = current.gameStats[gameId] ?? { played: 0, won: 0 };
      commit({
        ...current,
        gamesPlayed: current.gamesPlayed + 1,
        playsToday: current.playsToday + 1,
        gameStats: { ...current.gameStats, [gameId]: { ...stat, played: stat.played + 1 } },
      });
    },

    recordGameWon: (gameId) => {
      const current = withDaily(get());
      const stat = current.gameStats[gameId] ?? { played: 0, won: 0 };
      commit({
        ...current,
        gamesWon: current.gamesWon + 1,
        winsToday: current.winsToday + 1,
        gameStats: { ...current.gameStats, [gameId]: { ...stat, won: stat.won + 1 } },
      });
    },

    advanceQuest: () => {
      const current = withDaily(get());
      if (current.questCompleted) return;
      const questFoundCount = current.questFoundCount + 1;
      const justCompleted = questFoundCount >= 5;
      let next: PersistedShape = { ...current, questFoundCount, questCompleted: justCompleted };
      if (justCompleted) next = addReward(next, QUEST_REWARD);
      commit(next);
    },

    discoverExploreItem: (id, xpReward) => {
      const current = withDaily(get());
      if (current.discoveredExploreIds.includes(id)) return false;
      commit(addReward({ ...current, discoveredExploreIds: [...current.discoveredExploreIds, id] }, { xp: xpReward, coins: 0 }));
      return true;
    },

    visitBozUy: () => {
      const current = withDaily(get());
      if (current.bozUyVisited) return;
      commit(addReward({ ...current, bozUyVisited: true }, BOZ_UY_REWARD));
    },

    discoverCulture: () => {
      const current = withDaily(get());
      const next: PersistedShape = { ...current, cultureDiscoveryCount: current.cultureDiscoveryCount + 1 };
      commit(current.cultureDiscoveryCount === 0 ? addReward(next, CULTURE_DISCOVERY_REWARD) : next);
    },

    claimDailyChallenge: () => {
      const current = withDaily(get());
      const today = todayISO();
      if (current.winsToday < 1 || current.dailyChallengeClaimedDateISO === today) return false;
      commit(addReward({ ...current, dailyChallengeClaimedDateISO: today }, DAILY_CHALLENGE_REWARD));
      return true;
    },

    claimDailyGift: () => {
      const current = withDaily(get());
      const today = todayISO();
      if (current.dailyGiftClaimedDateISO === today) return false;
      commit(addReward({ ...current, dailyGiftClaimedDateISO: today }, DAILY_GIFT_REWARD));
      return true;
    },

    claimDailyPlay: () => {
      const current = withDaily(get());
      const today = todayISO();
      if (current.playsToday < DAILY_PLAY_GOAL || current.dailyPlayClaimedDateISO === today) return false;
      commit(addReward({ ...current, dailyPlayClaimedDateISO: today }, DAILY_PLAY_REWARD));
      return true;
    },

    acknowledgeAchievement: () => set({ lastUnlockedAchievementId: null }),
  };
});
