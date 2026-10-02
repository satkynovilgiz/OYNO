import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { isGoalSize, type GoalSize } from '@/features/goals/weeklyGoal';
import { safeJsonParse } from '@/services/storage/safeJson';

export const WEEKLY_GOAL_KEY = 'oyno.weeklyGoal.v1';

/** goal: null = "No weekly goal". celebratedWeek: the week whose
 * completion was already shown (so the small moment appears once). */
export type GoalSettings = { goal: GoalSize | null; celebratedWeek: string | null; dismissedForYouOn: string | null };
type Saved = Record<string, GoalSettings>;
const EMPTY: GoalSettings = { goal: null, celebratedWeek: null, dismissedForYouOn: null };

export function ownerGoal(saved: Saved, owner: string): GoalSettings {
  return saved[owner] ?? EMPTY;
}

type State = {
  isLoaded: boolean;
  saved: Saved;
  load: () => Promise<void>;
  setGoal: (owner: string, goal: GoalSize | null) => void;
  markCelebrated: (owner: string, week: string) => void;
  /** Home "For You Today" -> Not now (this local day only). */
  dismissForYou: (owner: string, day: string) => void;
  adoptGuest: (userId: string) => void;
};

/** Private, per-owner, on this device: the weekly goal setting plus two
 * small Home UI dates. Activity itself is never stored here - it is
 * derived from the existing completion records. */
export const useWeeklyGoalStore = create<State>((set, get) => {
  const persist = () => void AsyncStorage.setItem(WEEKLY_GOAL_KEY, JSON.stringify(get().saved)).catch(() => undefined);
  const update = (owner: string, patch: Partial<GoalSettings>) => {
    set({ saved: { ...get().saved, [owner]: { ...ownerGoal(get().saved, owner), ...patch } } });
    persist();
  };
  return {
    isLoaded: false,
    saved: {},
    load: async () => {
      if (get().isLoaded) return;
      const raw = await AsyncStorage.getItem(WEEKLY_GOAL_KEY).catch(() => null);
      const parsed = safeJsonParse<Saved>(raw, {});
      const saved: Saved = {};
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        for (const [owner, value] of Object.entries(parsed)) {
          saved[owner] = { goal: isGoalSize(value?.goal) ? value.goal : null, celebratedWeek: typeof value?.celebratedWeek === 'string' ? value.celebratedWeek : null, dismissedForYouOn: typeof value?.dismissedForYouOn === 'string' ? value.dismissedForYouOn : null };
        }
      }
      set({ saved, isLoaded: true });
    },
    setGoal: (owner, goal) => update(owner, { goal }),
    markCelebrated: (owner, week) => update(owner, { celebratedWeek: week }),
    dismissForYou: (owner, day) => update(owner, { dismissedForYouOn: day }),
    adoptGuest: (userId) => {
      const guest = get().saved.guest;
      if (!guest || userId === 'guest') return;
      const mine = get().saved[userId];
      // The account's own choice wins; a guest's goal only fills an unset one.
      const merged: GoalSettings = mine ? { ...mine, goal: mine.goal ?? guest.goal } : guest;
      const saved = { ...get().saved, [userId]: merged };
      delete saved.guest;
      set({ saved });
      persist();
    },
  };
});
