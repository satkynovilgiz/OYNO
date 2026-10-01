import { computeRegionProgress, regionStatus, type RegionProgress, type RegionSignals, type RegionStatus } from '@/features/explore/regions/regionModel';
import type { RegionExperienceConfig } from '@/features/explore/regions/regionExperiences';
import type { SupportedLanguage } from '@/i18n';
import { mapExploreRegionName, type ExploreRegionRow } from '@/services/content/types';

import { REGION_MAP_ANCHORS } from './illustratedMap';

export type MapMode = 'places' | 'progress';

export type RegionMapMarker = {
  id: string;
  name: string;
  /** 0..1 of the painting's width/height. */
  x: number;
  y: number;
  status: RegionStatus;
  progress: RegionProgress;
};

/**
 * One marker per Region Hub with an anchor and a loaded name, in the one
 * region order, with the SAME derived status the Passport and Home use.
 * Nothing is stored; no GPS, no borders.
 */
export function buildRegionMapMarkers(configs: readonly RegionExperienceConfig[], rows: readonly ExploreRegionRow[], signals: RegionSignals, language: SupportedLanguage): RegionMapMarker[] {
  return configs.flatMap((config) => {
    const anchor = REGION_MAP_ANCHORS[config.id];
    const row = rows.find((candidate) => candidate.id === config.id);
    if (!anchor || !row) return [];
    const progress = computeRegionProgress(config, signals);
    return [{ id: config.id, name: mapExploreRegionName(row)[language] ?? row.name_kg, x: anchor.xPercent / 100, y: anchor.yPercent / 100, status: regionStatus(progress), progress }];
  });
}

/** The Places / My progress switch is offered only on the open map: a
 * trail or region filter (?trail / ?region) keeps its own focused view. */
export function canShowProgressMode(highlightIds: readonly string[] | undefined): boolean {
  return !highlightIds;
}
