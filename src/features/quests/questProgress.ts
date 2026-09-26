import { isInteractiveExperienceCompleted, type InteractiveCompletionFlags } from '@/features/home/continueJourney';
import { progressGameIdFor } from '@/features/games/progressGameIds';
import type { GameStat } from '@/store/useProgressStore';

import type { GuidedQuest, QuestStep } from './questsData';

/** Real, account-scoped signals only - the same stores Journey, Trails and
 * Collections read. Nothing here marks a step done because a screen was
 * opened. */
export type QuestSignals = {
  completionFlags: InteractiveCompletionFlags;
  gameStats: Record<string, GameStat>;
  visitedRegionIds: string[];
  /** Challenge result keys ('collection:<id>', 'journey') with a finished run. */
  completedChallengeKeys: string[];
};

export type QuestStepState = 'completed' | 'current' | 'upcoming';
export type QuestStatus = 'notStarted' | 'active' | 'completed';

export type QuestProgress = {
  quest: GuidedQuest;
  steps: { step: QuestStep; state: QuestStepState }[];
  completed: number;
  total: number;
  status: QuestStatus;
  currentStep: QuestStep | null;
};

export function isQuestStepDone(step: QuestStep, signals: QuestSignals): boolean {
  switch (step.type) {
    case 'complete_interactive':
      return isInteractiveExperienceCompleted(step.targetId, signals.completionFlags);
    case 'play_game':
      return (signals.gameStats[progressGameIdFor(step.targetId)]?.played ?? 0) > 0;
    case 'explore_destination':
      return signals.visitedRegionIds.includes(step.targetId);
    case 'complete_challenge':
      return signals.completedChallengeKeys.includes(step.targetId);
  }
}

/** Steps are shown as a path: done ones are completed (in any order - real
 * activity is never discarded), the first not-done one is "current", the
 * rest "upcoming". */
export function computeQuestProgress(quest: GuidedQuest, signals: QuestSignals): QuestProgress {
  const done = quest.steps.map((step) => isQuestStepDone(step, signals));
  const currentIndex = done.indexOf(false);
  const steps = quest.steps.map((step, index) => ({
    step,
    state: done[index] ? ('completed' as const) : index === currentIndex ? ('current' as const) : ('upcoming' as const),
  }));
  const completed = done.filter(Boolean).length;
  const total = quest.steps.length;
  return {
    quest,
    steps,
    completed,
    total,
    status: completed === total ? 'completed' : completed > 0 ? 'active' : 'notStarted',
    currentStep: currentIndex >= 0 ? quest.steps[currentIndex] : null,
  };
}

/** One clear active quest: the started, unfinished quest with the most
 * progress (ties: catalogue order). */
export function pickActiveQuest(progress: QuestProgress[]): QuestProgress | null {
  const active = progress.filter((entry) => entry.status === 'active');
  if (active.length === 0) return null;
  return active.reduce((best, entry) => (entry.completed / entry.total > best.completed / best.total ? entry : best));
}

export function groupQuests(progress: QuestProgress[]): { active: QuestProgress | null; available: QuestProgress[]; completed: QuestProgress[] } {
  const active = pickActiveQuest(progress);
  return {
    active,
    available: progress.filter((entry) => entry.status !== 'completed' && entry !== active),
    completed: progress.filter((entry) => entry.status === 'completed'),
  };
}
