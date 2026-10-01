import type { TFunction } from 'i18next';

import { getGuidedQuest } from '@/features/quests/questsData';
import { getTrail } from '@/features/trails/trailsData';
import type { SupportedLanguage } from '@/i18n';
import { mapDiscoveryTitle, mapExploreRegionName, type DiscoveryRow, type ExploreRegionRow } from '@/services/content/types';

import type { StartHere } from './regionModel';

/** The name of a Start-here activity, resolved from real content - shared by
 * the Region Hub and Home so both always say the same thing. */
export function startHereName(next: StartHere, context: { regions: readonly ExploreRegionRow[] | undefined; discoveries: readonly DiscoveryRow[] | undefined; language: SupportedLanguage }): string {
  if (next.kind === 'destination') {
    const row = context.regions?.find((candidate) => candidate.id === next.id);
    return row ? (mapExploreRegionName(row)[context.language] ?? row.name_kg) : '';
  }
  if (next.kind === 'discovery') {
    const row = context.discoveries?.find((candidate) => candidate.id === next.id);
    return row ? (mapDiscoveryTitle(row)[context.language] ?? row.title_kg) : '';
  }
  if (next.kind === 'trail') {
    const trail = getTrail(next.id);
    return trail ? (trail.title[context.language] ?? trail.title.kg) : '';
  }
  if (next.kind === 'quest') {
    const quest = getGuidedQuest(next.id);
    return quest ? (quest.title[context.language] ?? quest.title.kg) : '';
  }
  return '';
}

/** "Visit Son-Köl" / "Find “Issyk-Kul shore”" ... (regionHub.start.*). */
export function startHereLabel(next: StartHere, name: string, t: TFunction): string {
  if (next.kind === 'done') return t('regionHub.start.done');
  return t(`regionHub.start.${next.kind}`, { name });
}
