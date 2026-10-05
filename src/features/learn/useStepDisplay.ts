import { useTranslation } from 'react-i18next';

import { collections } from '@/features/collections/collectionsData';
import { GLOSSARY } from '@/features/culture/glossary/glossaryData';
import { INTERACTIVE_EXPERIENCES } from '@/features/culture/interactiveExperiences';
import { GAME_RECORD_RULES } from '@/features/games/records/gameRecords';
import { gameTitleKey } from '@/features/games/types';
import type { SupportedLanguage } from '@/i18n';
import { useAllCultureItems } from '@/services/content/cultureItemsService';

import { stepRoute, type LearningPathStep } from './learningPaths';

export function gameRouteFor(gameId: string): string | null {
  return GAME_RECORD_RULES[gameId]?.route ?? null;
}

/**
 * - ready    the content exists; `route` opens it
 * - loading  the article catalogue is still loading (title "…")
 * - failed   the article catalogue could not be loaded (retry with useStepCatalog)
 * - missing  the content no longer exists: labelled as such, `route` is null
 */
export type StepContentStatus = 'ready' | 'loading' | 'failed' | 'missing';
export type StepDisplay = { verb: string; title: string; route: string | null; status: StepContentStatus };

/** Title + action verb + route for a step - resolved from the existing
 * content each time (nothing copied into the path config). */
export function useStepDisplay(): (step: LearningPathStep) => StepDisplay {
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const { data: items, isError } = useAllCultureItems();
  const missing = (verb: string): StepDisplay => ({ verb, title: t('pathJourney.stepRemoved'), route: null, status: 'missing' });
  return (step) => {
    const route = stepRoute(step, gameRouteFor);
    const verb = t(`learningPaths.verb.${step.type}`);
    switch (step.type) {
      case 'culture_item': {
        if (!items) return { verb, route, title: '…', status: isError ? 'failed' : 'loading' };
        const item = items.find((candidate) => candidate.id === step.targetId);
        return item ? { verb, route, title: item.title, status: 'ready' } : missing(verb);
      }
      case 'glossary': {
        const entry = GLOSSARY.find((candidate) => candidate.id === step.targetId);
        return entry ? { verb, route, title: entry.term, status: 'ready' } : missing(verb);
      }
      case 'challenge': {
        const collection = collections.find((entry) => `collection-${entry.id}` === step.targetId);
        return collection ? { verb, route, title: collection.title[language] ?? collection.title.kg, status: 'ready' } : missing(verb);
      }
      case 'game': {
        const rule = GAME_RECORD_RULES[step.targetId];
        return rule && route ? { verb, route, title: t(gameTitleKey(rule.listId)), status: 'ready' } : missing(verb);
      }
      case 'interactive_lab': {
        const lab = INTERACTIVE_EXPERIENCES.find((entry) => entry.id === step.targetId);
        return lab && route ? { verb, route, title: t(lab.titleKey), status: 'ready' } : missing(verb);
      }
    }
  };
}

/** The article catalogue behind step titles: failed to load, and a retry. */
export function useStepCatalog(): { failed: boolean; retry: () => void } {
  const { data, isError, refetch } = useAllCultureItems();
  return { failed: !data && isError, retry: () => void refetch() };
}
