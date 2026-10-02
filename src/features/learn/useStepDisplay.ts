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

/** Title + action verb + route for a step - resolved from the existing
 * content each time (nothing copied into the path config). */
export function useStepDisplay(): (step: LearningPathStep) => { verb: string; title: string; route: string | null } {
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const { data: items } = useAllCultureItems();
  return (step) => {
    const route = stepRoute(step, gameRouteFor);
    const verb = t(`learningPaths.verb.${step.type}`);
    switch (step.type) {
      case 'culture_item':
        return { verb, route, title: items?.find((item) => item.id === step.targetId)?.title ?? '…' };
      case 'glossary':
        return { verb, route, title: GLOSSARY.find((entry) => entry.id === step.targetId)?.term ?? step.targetId };
      case 'challenge': {
        const collection = collections.find((entry) => `collection-${entry.id}` === step.targetId);
        return { verb, route, title: collection ? (collection.title[language] ?? collection.title.kg) : step.targetId };
      }
      case 'game': {
        const rule = GAME_RECORD_RULES[step.targetId];
        return { verb, route, title: rule ? t(gameTitleKey(rule.listId)) : step.targetId };
      }
      case 'interactive_lab': {
        const lab = INTERACTIVE_EXPERIENCES.find((entry) => entry.id === step.targetId);
        return { verb, route, title: lab ? t(lab.titleKey) : step.targetId };
      }
    }
  };
}
