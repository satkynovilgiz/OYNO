import type { ImageSourcePropType } from 'react-native';

import type { SupportedLanguage } from '@/i18n';
import { mapExploreRegionName, type ExploreRegionRow } from '@/services/content/types';

import { listRegionExperiences, regionHubRoute, regionTone, type RegionExperienceConfig } from './regionExperiences';
import { computeRegionProgress, type RegionProgress, type RegionSignals } from './regionModel';

export type RegionRailItem = {
  id: string;
  name: string;
  imageSource: ImageSourcePropType | null;
  tone: string;
  progress: RegionProgress;
  completed: boolean;
  route: string;
};

/**
 * The "Explore by region" cards: every supported Region Hub config (no
 * second list), in its fixed order, with the SAME progress the hub shows. A
 * region whose explore_regions row isn't loaded is left out rather than
 * shown nameless.
 */
export function buildRegionRailItems(rows: readonly ExploreRegionRow[], language: SupportedLanguage, signals: RegionSignals, configs: readonly RegionExperienceConfig[] = listRegionExperiences()): RegionRailItem[] {
  return configs.flatMap((config) => {
    const row = rows.find((candidate) => candidate.id === config.id);
    if (!row) return [];
    const progress = computeRegionProgress(config, signals);
    return [
      {
        id: config.id,
        name: mapExploreRegionName(row)[language] ?? row.name_kg,
        imageSource: config.heroImage,
        tone: regionTone(config.id),
        progress,
        completed: progress.total > 0 && progress.completed === progress.total,
        route: regionHubRoute(config.id),
      },
    ];
  });
}
