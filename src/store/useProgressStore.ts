import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { enqueueUnlocks } from '@/services/progress/unlockQueue';

import { track } from '@/services/analytics/analytics';
import type { AchievementId } from '@/services/progress/types';
import { safeJsonParse } from '@/services/storage/safeJson';
import { supabase } from '@/services/supabase/client';
import { captureAccountGeneration, isAccountGenerationCurrent, type AccountGenerationToken } from '@/services/sync/accountGeneration';
import { mergeVisits } from '@/services/sync/mergeRules';
import { addPendingVisit, readPendingVisits } from '@/services/sync/outbox';
import { requestAccountSync } from '@/services/sync/syncTrigger';
import { useAuthStore } from '@/store/useAuthStore';

const CACHE_KEY = 'oyno.progress.cache';

// Display-only reward previews (e.g. "+100 XP" shown on the Daily
// Challenge card before claiming) - the actual awarding happens
// server-side now (supabase/migrations/20260823000001_progress.sql), so
// these must be kept in sync with that file's hardcoded amounts by hand;
// there's no single source of truth for both yet (that needs the reward
// config to move server-side too - a Phase 6d/CMS concern, not this one).
export const DAILY_CHALLENGE_REWARD = { xp: 100, coins: 50 };
export const DAILY_GIFT_REWARD = { xp: 20, coins: 30 };
export const DAILY_PLAY_GOAL = 3;
export const DAILY_PLAY_REWARD = { xp: 30, coins: 20 };
export const QUEST_REWARD = { xp: 80, coins: 40 };
export const BOZ_UY_REWARD = { xp: 15, coins: 0 };
export const CULTURE_DISCOVERY_REWARD = { xp: 15, coins: 0 };
export const DAILY_QUIZ_REWARD = { xp: 40, coins: 25 };
export const QUIZ_PASS_RATIO = 0.7;
export const OYMO_REWARD = { xp: 20, coins: 10 };
export const SHYRDAK_REWARD = { xp: 20, coins: 10 };
export const KOMUZ_LESSON_REWARD = { xp: 15, coins: 0 };

export type GameStat = { played: number; won: number };

type ProgressRow = {
  xp: number;
  coins: number;
  gems: number;
  games_played: number;
  games_won: number;
  streak_days: number;
  wins_today: number;
  plays_today: number;
  daily_challenge_claimed_date: string | null;
  daily_gift_claimed_date: string | null;
  daily_play_claimed_date: string | null;
  quiz_claimed_date: string | null;
  quest_found_count: number;
  quest_completed: boolean;
  boz_uy_visited: boolean;
  culture_discovery_count: number;
  oymo_created: boolean;
  shyrdak_created: boolean;
  komuz_lesson_completed: boolean;
};

type ProgressFields = {
  xp: number;
  coins: number;
  gems: number;
  gamesPlayed: number;
  gamesWon: number;
  streakDays: number;
  winsToday: number;
  playsToday: number;
  dailyChallengeClaimedDateISO: string | null;
  dailyGiftClaimedDateISO: string | null;
  dailyPlayClaimedDateISO: string | null;
  quizClaimedDateISO: string | null;
  questFoundCount: number;
  questCompleted: boolean;
  bozUyVisited: boolean;
  cultureDiscoveryCount: number;
  oymoCreated: boolean;
  shyrdakCreated: boolean;
  komuzLessonCompleted: boolean;
};

type CachedShape = ProgressFields & {
  gameStats: Record<string, GameStat>;
  discoveredExploreIds: string[];
  unlockedAchievementIds: AchievementId[];
  visitedRegionIds: string[];
  /** region id -> ISO `user_region_visits.visited_at`. Optional so caches
   * written before this field existed still parse. */
  regionVisitDates?: Record<string, string>;
  completedQuestStepIds: string[];
  /** Whose account this cache holds. A cache written for another account
   * (or before this field existed) is never shown to the current user. */
  ownerId?: string;
};

export const PROGRESS_CACHE_KEY = CACHE_KEY;

const DEFAULT_FIELDS: ProgressFields = {
  xp: 0,
  coins: 0,
  gems: 0,
  gamesPlayed: 0,
  gamesWon: 0,
  streakDays: 0,
  winsToday: 0,
  playsToday: 0,
  dailyChallengeClaimedDateISO: null,
  dailyGiftClaimedDateISO: null,
  dailyPlayClaimedDateISO: null,
  quizClaimedDateISO: null,
  questFoundCount: 0,
  questCompleted: false,
  bozUyVisited: false,
  cultureDiscoveryCount: 0,
  oymoCreated: false,
  shyrdakCreated: false,
  komuzLessonCompleted: false,
};

function mapRow(row: ProgressRow): ProgressFields {
  return {
    xp: row.xp,
    coins: row.coins,
    gems: row.gems,
    gamesPlayed: row.games_played,
    gamesWon: row.games_won,
    streakDays: row.streak_days,
    winsToday: row.wins_today,
    playsToday: row.plays_today,
    dailyChallengeClaimedDateISO: row.daily_challenge_claimed_date,
    dailyGiftClaimedDateISO: row.daily_gift_claimed_date,
    dailyPlayClaimedDateISO: row.daily_play_claimed_date,
    quizClaimedDateISO: row.quiz_claimed_date,
    questFoundCount: row.quest_found_count,
    questCompleted: row.quest_completed,
    bozUyVisited: row.boz_uy_visited,
    cultureDiscoveryCount: row.culture_discovery_count,
    oymoCreated: row.oymo_created,
    shyrdakCreated: row.shyrdak_created,
    komuzLessonCompleted: row.komuz_lesson_completed,
  };
}

function currentUserId(): string | undefined {
  return useAuthStore.getState().user?.id;
}

async function readCache(): Promise<CachedShape | null> {
  const raw = await AsyncStorage.getItem(CACHE_KEY).catch(() => null);
  const cached = safeJsonParse<CachedShape | null>(raw, null);
  const userId = currentUserId();
  return cached && userId && cached.ownerId === userId ? cached : null;
}

async function writeCache(state: CachedShape) {
  const ownerId = currentUserId();
  if (!ownerId) return;
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ ...state, ownerId })).catch(() => {});
}

/** Visits waiting in the sync outbox (a guest's, or made offline). */
async function pendingVisitSet() {
  const pending = await readPendingVisits();
  return { ids: Object.keys(pending), dates: pending };
}

/** True only for a real signed-in user - guests have no Supabase session,
 * so auth.uid() is null server-side and every RPC call below would fail
 * with NOT_AUTHENTICATED. Matches useAuthStore's own documented intent
 * ("guests can browse/play single-player; progress isn't saved") - now
 * actually enforced by the backend instead of just stated in a comment. */
function isRealUser(): boolean {
  return useAuthStore.getState().status === 'authenticated';
}

type RpcResult = { progress: ProgressRow; newlyUnlocked?: AchievementId[]; correct?: number; total?: number; rewarded?: boolean };

type ProgressState = ProgressFields & {
  isLoaded: boolean;
  error: string | null;
  gameStats: Record<string, GameStat>;
  discoveredExploreIds: string[];
  unlockedAchievementIds: AchievementId[];
  /** Head of the unlock-modal queue (null when nothing is waiting). */
  lastUnlockedAchievementId: AchievementId | null;
  /** Newly unlocked achievements still to be shown, oldest first - so two
   * unlocks at once show one after the other instead of dropping one. */
  pendingAchievementIds: AchievementId[];
  visitedRegionIds: string[];
  /** region id -> when it was first visited (the real server timestamp,
   * `user_region_visits.visited_at`). Read by the Discovery Passport to
   * date its stamps; a region with no entry simply shows no date. */
  regionVisitDates: Record<string, string>;
  completedQuestStepIds: string[];
  /** `session`: the account session this load is for (the sync engine
   * passes its own); omitted = the session current at call time. A
   * response that arrives after that session ended changes nothing. */
  load: (session?: AccountGenerationToken) => Promise<void>;
  recordGamePlayed: (gameId: string) => Promise<void>;
  recordGameWon: (gameId: string) => Promise<void>;
  advanceQuest: () => Promise<void>;
  advanceQuestStep: (stepType: string, targetId: string) => Promise<void>;
  visitExploreRegion: (regionId: string) => Promise<void>;
  discoverExploreItem: (id: string) => Promise<void>;
  visitBozUy: () => Promise<void>;
  discoverCulture: () => Promise<void>;
  claimDailyChallenge: () => Promise<boolean>;
  claimDailyGift: () => Promise<boolean>;
  claimDailyPlay: () => Promise<boolean>;
  claimDailyQuiz: (answers: { question_id: string; choice_index: number }[]) => Promise<{ correct: number; total: number; rewarded: boolean } | null>;
  saveOymoCreation: (params: { name: string; layers: unknown; backgroundColor: string; symmetryMode: string }) => Promise<boolean>;
  deleteOymoCreation: (id: string) => Promise<boolean>;
  saveShyrdakCreation: (params: {
    baseColor: string;
    secondaryColor: string;
    patternId: string;
    borderEnabled: boolean;
    symmetryMode: string;
  }) => Promise<boolean>;
  completeKomuzLesson: () => Promise<boolean>;
  acknowledgeAchievement: () => void;
};

export const useProgressStore = create<ProgressState>((set, get) => {
  function cacheSnapshot(fields: ProgressFields, unlockedAchievementIds: AchievementId[]): CachedShape {
    const current = get();
    return {
      ...fields,
      gameStats: current.gameStats,
      discoveredExploreIds: current.discoveredExploreIds,
      unlockedAchievementIds,
      visitedRegionIds: current.visitedRegionIds,
      regionVisitDates: current.regionVisitDates,
      completedQuestStepIds: current.completedQuestStepIds,
    };
  }

  function applyProgress(row: ProgressRow, newlyUnlocked?: AchievementId[]) {
    const fields = mapRow(row);
    const current = get();
    const unlockedAchievementIds = newlyUnlocked?.length
      ? Array.from(new Set([...current.unlockedAchievementIds, ...newlyUnlocked]))
      : current.unlockedAchievementIds;

    newlyUnlocked?.forEach((id) => track('achievement_unlocked', { achievementId: id }));

    // Only a server-reported *new* unlock is queued - loading existing
    // progress never replays old achievements as "new".
    const genuinelyNew = newlyUnlocked?.filter((id) => !current.unlockedAchievementIds.includes(id));
    const pendingAchievementIds = enqueueUnlocks(current.pendingAchievementIds, genuinelyNew);
    set({
      ...fields,
      unlockedAchievementIds,
      pendingAchievementIds,
      lastUnlockedAchievementId: pendingAchievementIds[0] ?? null,
      error: null,
    });

    void writeCache(cacheSnapshot(fields, unlockedAchievementIds));
  }

  // Duplicate-claim/eligibility guards on the server (ALREADY_CLAIMED,
  // NOT_ELIGIBLE, ALREADY_COMPLETED) are expected rejections, not bugs -
  // callers that care check the boolean return value. Anything else is a
  // real failure and goes into `error` for the UI.
  const EXPECTED_REJECTIONS = ['ALREADY_CLAIMED', 'NOT_ELIGIBLE', 'ALREADY_COMPLETED', 'NOT_AUTHENTICATED'];

  // Every server action goes through here, so this one guard covers them
  // all: a response for a session that has since ended (sign-out, another
  // account, or the same account signed in again) is dropped - no store
  // update, no achievement modal, no cache write.
  async function callAction(fn: string, args?: Record<string, unknown>): Promise<RpcResult | null> {
    if (!isRealUser()) return null;
    const session = captureAccountGeneration();
    const { data, error } = await supabase.rpc(fn, args);
    if (!isAccountGenerationCurrent(session)) return null;
    if (error) {
      if (!EXPECTED_REJECTIONS.some((code) => error.message?.includes(code))) {
        set({ error: error.message });
      }
      return null;
    }
    return data as RpcResult;
  }

  return {
    ...DEFAULT_FIELDS,
    isLoaded: false,
    error: null,
    gameStats: {},
    discoveredExploreIds: [],
    unlockedAchievementIds: [],
    lastUnlockedAchievementId: null,
    pendingAchievementIds: [],
    visitedRegionIds: [],
    regionVisitDates: {},
    completedQuestStepIds: [],

    load: async (session) => {
      const token = session ?? captureAccountGeneration();
      const current = () => isAccountGenerationCurrent(token);
      // A (re)load is an account/session boundary: a modal waiting for the
      // previous account must never appear for the next one.
      set({ pendingAchievementIds: [], lastUnlockedAchievementId: null });
      const pending = await pendingVisitSet();
      if (!current()) return;
      if (!isRealUser()) {
        // Guests have no server progress, but places they open are kept
        // (sync outbox) so Passport/Journey/Map work and the visits merge
        // into their account when they sign in.
        set({
          ...DEFAULT_FIELDS,
          gameStats: {},
          discoveredExploreIds: [],
          unlockedAchievementIds: [],
          visitedRegionIds: pending.ids,
          regionVisitDates: pending.dates,
          completedQuestStepIds: [],
          isLoaded: true,
          error: null,
        });
        return;
      }
      // Every step below re-checks the session: a slow response for a
      // session that ended (even the same account signed in again) is dropped.
      const stillSameUser = () => isRealUser() && current();
      // Render the last-known account progress immediately; the server
      // fetch below replaces it in the background (never a blank wait).
      const cachedFirst = await readCache();
      if (!stillSameUser()) return;
      if (cachedFirst && !get().isLoaded) {
        const visits = mergeVisits({ ids: cachedFirst.visitedRegionIds, dates: cachedFirst.regionVisitDates ?? {} }, pending);
        set({ ...cachedFirst, visitedRegionIds: visits.ids, regionVisitDates: visits.dates, isLoaded: true, error: null });
      }
      try {
        const [progressRes, gameStatsRes, achievementsRes, discoveriesRes, regionVisitsRes, questStepsRes] = await Promise.all([
          supabase.from('user_progress').select('*').single(),
          supabase.from('user_game_stats').select('game_id, played, won'),
          supabase.from('user_achievements').select('achievement_id'),
          supabase.from('user_discoveries').select('discovery_id'),
          supabase.from('user_region_visits').select('region_id, visited_at'),
          supabase.from('user_quest_steps').select('step_id'),
        ]);
        if (!stillSameUser()) return;
        if (progressRes.error) throw progressRes.error;

        const gameStats: Record<string, GameStat> = {};
        for (const row of gameStatsRes.data ?? []) {
          gameStats[row.game_id as string] = { played: row.played as number, won: row.won as number };
        }
        const unlockedAchievementIds = (achievementsRes.data ?? []).map((r) => r.achievement_id as AchievementId);
        const discoveredExploreIds = (discoveriesRes.data ?? []).map((r) => r.discovery_id as string);
        const visitedRegionIds = (regionVisitsRes.data ?? []).map((r) => r.region_id as string);
        const regionVisitDates: Record<string, string> = {};
        for (const row of regionVisitsRes.data ?? []) {
          if (row.visited_at) regionVisitDates[row.region_id as string] = row.visited_at as string;
        }
        const completedQuestStepIds = (questStepsRes.data ?? []).map((r) => r.step_id as string);
        const fields = mapRow(progressRes.data as ProgressRow);
        // Visits not yet on the server stay visible (union, earliest date).
        const visits = mergeVisits({ ids: visitedRegionIds, dates: regionVisitDates }, pending);
        visitedRegionIds.splice(0, visitedRegionIds.length, ...visits.ids);
        Object.assign(regionVisitDates, visits.dates);

        if (!stillSameUser()) return;
        set({
          ...fields,
          gameStats,
          unlockedAchievementIds,
          discoveredExploreIds,
          visitedRegionIds,
          regionVisitDates,
          completedQuestStepIds,
          isLoaded: true,
          error: null,
        });
        void writeCache({ ...fields, gameStats, unlockedAchievementIds, discoveredExploreIds, visitedRegionIds, regionVisitDates, completedQuestStepIds });
      } catch {
        // Offline or a real failure - fall back to the last successful
        // fetch so the UI shows real (if stale) numbers instead of
        // zeros, matching Phase 5's offline-mode intent. Actions still go
        // through callAction and fail honestly rather than faking a
        // local update while offline.
        const cached = await readCache();
        if (!stillSameUser()) return;
        if (cached) {
          const visits = mergeVisits({ ids: cached.visitedRegionIds, dates: cached.regionVisitDates ?? {} }, pending);
          set({ ...cached, visitedRegionIds: visits.ids, regionVisitDates: visits.dates, isLoaded: true, error: 'offline' });
        } else set({ visitedRegionIds: pending.ids, regionVisitDates: pending.dates, isLoaded: true, error: 'offline' });
      }
    },

    recordGamePlayed: async (gameId) => {
      const result = await callAction('record_game_played', { p_game_id: gameId });
      if (!result) return;
      applyProgress(result.progress);
      const stat = get().gameStats[gameId] ?? { played: 0, won: 0 };
      set({ gameStats: { ...get().gameStats, [gameId]: { ...stat, played: stat.played + 1 } } });
    },

    recordGameWon: async (gameId) => {
      const result = await callAction('record_game_won', { p_game_id: gameId });
      if (!result) return;
      applyProgress(result.progress, result.newlyUnlocked);
      const stat = get().gameStats[gameId] ?? { played: 0, won: 0 };
      set({ gameStats: { ...get().gameStats, [gameId]: { ...stat, won: stat.won + 1 } } });
    },

    advanceQuest: async () => {
      const wasNotStarted = get().questFoundCount === 0;
      const result = await callAction('advance_quest');
      if (!result) return;
      applyProgress(result.progress, result.newlyUnlocked);
      if (wasNotStarted) track('quest_started');
      if (result.progress.quest_completed) track('quest_completed');
    },

    // Event-driven replacement for advanceQuest(): reports "this step-type/
    // target event just happened" (region opened, item discovered, culture
    // item read) rather than a bare "advance" tap. The server only actually
    // advances if this matches the caller's real next incomplete step, so
    // reporting an event that isn't the next step is a harmless no-op.
    advanceQuestStep: async (stepType, targetId) => {
      const wasNotStarted = get().questFoundCount === 0;
      const wasCompleted = get().questCompleted;
      const foundCountBefore = get().questFoundCount;
      const result = await callAction('advance_quest_step', { p_step_type: stepType, p_target_id: targetId });
      if (!result) return;
      applyProgress(result.progress, result.newlyUnlocked);
      if (result.progress.quest_found_count > foundCountBefore) {
        track('quest_step_completed', { stepType, targetId });
      }
      if (wasNotStarted && result.progress.quest_found_count > 0) track('quest_started');
      if (!wasCompleted && result.progress.quest_completed) track('quest_completed');
    },

    // No progress reward here (visiting isn't itself XP-earning), so this
    // doesn't go through callAction/applyProgress like the reward actions.
    // Local first for everyone: the visit shows at once (also offline and
    // for guests) and waits in the sync outbox; the sync layer sends it to
    // the idempotent visit_explore_region RPC and removes it only once
    // the server accepted it - so a retry can never double-record.
    visitExploreRegion: async (regionId) => {
      if (get().visitedRegionIds.includes(regionId)) return;
      const now = new Date().toISOString();
      set({
        visitedRegionIds: [...get().visitedRegionIds, regionId],
        regionVisitDates: { ...get().regionVisitDates, [regionId]: now },
      });
      await addPendingVisit(regionId, now);
      if (isRealUser()) {
        void writeCache(cacheSnapshot(get(), get().unlockedAchievementIds));
        requestAccountSync('local_change');
      }
      track('region_opened', { regionId });
    },

    discoverExploreItem: async (id) => {
      const isNew = !get().discoveredExploreIds.includes(id);
      const result = await callAction('discover_explore_item', { p_discovery_id: id });
      if (!result) return;
      applyProgress(result.progress);
      if (isNew) {
        set({ discoveredExploreIds: [...get().discoveredExploreIds, id] });
        track('location_discovered', { locationId: id });
        track('collection_item_discovered', { itemId: id });
        track('discovery_found', { discoveryId: id });
        void get().advanceQuestStep('DISCOVER_ITEM', id);
      }
    },

    visitBozUy: async () => {
      const result = await callAction('visit_boz_uy');
      if (!result) return;
      applyProgress(result.progress, result.newlyUnlocked);
    },

    discoverCulture: async () => {
      const result = await callAction('discover_culture');
      if (!result) return;
      applyProgress(result.progress, result.newlyUnlocked);
      track('culture_complete');
    },

    claimDailyChallenge: async () => {
      const result = await callAction('claim_daily_challenge');
      if (!result) return false;
      applyProgress(result.progress);
      track('reward_claimed', { source: 'daily_challenge' });
      return true;
    },

    claimDailyGift: async () => {
      const result = await callAction('claim_daily_gift');
      if (!result) return false;
      applyProgress(result.progress);
      track('reward_claimed', { source: 'daily_gift' });
      return true;
    },

    claimDailyPlay: async () => {
      const result = await callAction('claim_daily_play');
      if (!result) return false;
      applyProgress(result.progress);
      track('reward_claimed', { source: 'daily_play' });
      return true;
    },

    claimDailyQuiz: async (answers) => {
      const result = await callAction('claim_daily_quiz', { p_answers: answers });
      if (!result) return null;
      applyProgress(result.progress);
      const rewarded = !!result.rewarded;
      if (rewarded) track('reward_claimed', { source: 'daily_quiz' });
      return { correct: result.correct ?? 0, total: result.total ?? answers.length, rewarded };
    },

    saveOymoCreation: async ({ name, layers, backgroundColor, symmetryMode }) => {
      const result = await callAction('save_oymo_creation', {
        p_name: name,
        p_layers: layers,
        p_background_color: backgroundColor,
        p_symmetry_mode: symmetryMode,
      });
      if (!result) return false;
      applyProgress(result.progress);
      track('reward_claimed', { source: 'oymo_creation' });
      return true;
    },

    deleteOymoCreation: async (id) => {
      const result = await callAction('delete_oymo_creation', { p_id: id });
      return !!result;
    },

    saveShyrdakCreation: async ({ baseColor, secondaryColor, patternId, borderEnabled, symmetryMode }) => {
      const result = await callAction('save_shyrdak_creation', {
        p_base_color: baseColor,
        p_secondary_color: secondaryColor,
        p_pattern_id: patternId,
        p_border_enabled: borderEnabled,
        p_symmetry_mode: symmetryMode,
      });
      if (!result) return false;
      applyProgress(result.progress);
      track('reward_claimed', { source: 'shyrdak_creation' });
      return true;
    },

    completeKomuzLesson: async () => {
      const result = await callAction('complete_komuz_lesson');
      if (!result) return false;
      applyProgress(result.progress, result.newlyUnlocked);
      track('reward_claimed', { source: 'komuz_lesson' });
      return true;
    },

    acknowledgeAchievement: () => {
      const rest = get().pendingAchievementIds.slice(1);
      set({ pendingAchievementIds: rest, lastUnlockedAchievementId: rest[0] ?? null });
    },
  };
});
