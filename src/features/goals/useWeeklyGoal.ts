import { useEffect, useMemo } from 'react';

import { useGameRecords, useRecordsOwner } from '@/features/games/records/useGameRecords';
import { track } from '@/services/analytics/analytics';
import { useChallengeStore } from '@/store/useChallengeStore';
import { useGlossaryStudyStore } from '@/store/useGlossaryStudyStore';
import { ownerManualSteps, useLearningPathStore } from '@/store/useLearningPathStore';
import { ownerReading, useReadingStore } from '@/store/useReadingStore';
import { ownerGoal, useWeeklyGoalStore } from '@/store/useWeeklyGoalStore';

import { collectActivityEvents, goalState, weekKey, type GoalSize, type WeeklyGoalState } from './weeklyGoal';

/** The current owner's weekly goal, derived from the existing dated
 * completion records on THIS device (re-selected on account change). */
export function useWeeklyGoal(): { state: WeeklyGoalState | null; goal: GoalSize | null; owner: string; setGoal: (goal: GoalSize | null) => void } {
  const owner = useRecordsOwner();
  const settings = ownerGoal(useWeeklyGoalStore((state) => state.saved), owner);
  const reading = ownerReading(useReadingStore((state) => state.saved), owner);
  const challengeResults = useChallengeStore((state) => state.results);
  const sessions = useGlossaryStudyStore((state) => state.sessions[owner]);
  const manual = ownerManualSteps(useLearningPathStore((state) => state.saved), owner);
  const { records } = useGameRecords();

  useEffect(() => {
    void useWeeklyGoalStore.getState().load();
    void useReadingStore.getState().load();
    void useGlossaryStudyStore.getState().load();
    void useLearningPathStore.getState().load();
  }, []);

  const events = useMemo(
    () =>
      collectActivityEvents({
        readings: Object.values(reading),
        challengeResults,
        glossarySessions: sessions ?? [],
        manualPathSteps: manual,
        gameSessions: Object.values(records.recent).flat(),
      }),
    [reading, challengeResults, sessions, manual, records],
  );
  const state = goalState(settings.goal, events, new Date());

  // The completion moment is noted once per week (no reward, no badge).
  const week = weekKey(new Date());
  useEffect(() => {
    if (state?.complete && settings.celebratedWeek !== week) {
      useWeeklyGoalStore.getState().markCelebrated(owner, week);
      track('weekly_goal_completed', { goal_size: state.goal });
    }
  }, [state?.complete, state?.goal, settings.celebratedWeek, week, owner]);

  return {
    state,
    goal: settings.goal,
    owner,
    setGoal: (goal) => {
      useWeeklyGoalStore.getState().setGoal(owner, goal);
      track('weekly_goal_set', { goal_size: goal ?? 0 });
    },
  };
}
