import type { ImageSourcePropType } from 'react-native';

import { INTERACTIVE_EXPERIENCES, routeForInteractiveExperience } from '@/features/culture/interactiveExperiences';
import { findNextIncompleteStep, resolveStepRoute, type QuestStep } from '@/services/explore/questSteps';

export type ContinueJourneyCardData =
  | {
      kind: 'quest';
      title: string;
      subtitle: string;
      current: number;
      total: number;
      ctaRoute: string;
    }
  | {
      kind: 'discover';
      titleKey: string;
      imageSource: ImageSourcePropType;
      ctaRoute: string;
    };

export type InteractiveCompletionFlags = {
  bozUyVisited: boolean;
  oymoCreated: boolean;
  shyrdakCreated: boolean;
  komuzLessonCompleted: boolean;
};

const COMPLETION_KEY_BY_EXPERIENCE: Record<string, keyof InteractiveCompletionFlags> = {
  'boz-uy': 'bozUyVisited',
  oymo: 'oymoCreated',
  shyrdak: 'shyrdakCreated',
  komuz: 'komuzLessonCompleted',
};

/**
 * One primary "continue your journey" card (spec "Task 7... Show ONE
 * strong primary continuation card rather than several competing cards -
 * never invent progress") - driven entirely by state the app already
 * tracks, nothing new:
 *
 * 1. An active quest with a genuinely incomplete step is the one mechanic
 *    in the app with real resumable progress, so it always wins when one
 *    exists - same `findNextIncompleteStep`/`resolveStepRoute` Explore
 *    itself uses, so the CTA lands on the exact same next step.
 * 2. Otherwise, the first not-yet-tried interactive experience (Оймо/Боз
 *    үй/Шырдак/Комуз, in `INTERACTIVE_EXPERIENCES`' own fixed order)
 *    becomes a "Discover" prompt - real state (has the user ever tried
 *    this?), not a fabricated recommendation.
 * 3. If the quest is complete AND every interactive experience has
 *    already been tried, there is genuinely nothing left to "continue" -
 *    returns null rather than inventing a card (spec "Avoid showing
 *    completed content as if it is new").
 */
/** Whether an interactive experience has its real completion flag set -
 * shared with Collections progress so both read the same four flags. */
export function isInteractiveExperienceCompleted(experienceId: string, flags: InteractiveCompletionFlags): boolean {
  const key = COMPLETION_KEY_BY_EXPERIENCE[experienceId];
  return key ? flags[key] : false;
}

export function resolveContinueJourney(
  quest: { title: string; subtitle: string; current: number; total: number; completed: boolean } | null,
  questSteps: QuestStep[],
  completedQuestStepIds: string[],
  discoveryRegionId: (step: QuestStep) => string | null,
  completionFlags: InteractiveCompletionFlags,
): ContinueJourneyCardData | null {
  if (quest && !quest.completed) {
    const nextStep = findNextIncompleteStep(questSteps, completedQuestStepIds);
    if (nextStep) {
      return {
        kind: 'quest',
        title: quest.title,
        subtitle: quest.subtitle,
        current: quest.current,
        total: quest.total,
        ctaRoute: resolveStepRoute(nextStep, discoveryRegionId(nextStep)),
      };
    }
  }

  const nextExperience = INTERACTIVE_EXPERIENCES.find((experience) => !completionFlags[COMPLETION_KEY_BY_EXPERIENCE[experience.id]]);
  if (nextExperience) {
    const ctaRoute = routeForInteractiveExperience(nextExperience.id);
    if (ctaRoute) {
      return {
        kind: 'discover',
        titleKey: nextExperience.titleKey,
        imageSource: nextExperience.imageSource,
        ctaRoute,
      };
    }
  }

  return null;
}
