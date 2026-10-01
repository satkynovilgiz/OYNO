import type { SupportedLanguage } from '@/i18n';
import type { ContentDepth } from '@/services/ageExperience/types';
import { cultureItemNarration, materialNarration, placeNarration } from '@/services/audioGuide/contentNarration';
import type { Narration } from '@/services/audioGuide/narration';
import { regionTagline } from '@/services/content/regionTaglines';
import { mapExploreRegionName, type CultureItemRow, type CultureMaterialRow, type ExploreRegionRow } from '@/services/content/types';

import type { RegionExperienceConfig } from './regionExperiences';

/**
 * Regional Audio Journeys - an ordered listening route through a region's
 * EXISTING narrated content (its places, then its culture items, then its
 * materials). Each stop reads exactly what that content's own page reads
 * (services/audioGuide/contentNarration). Pure: no playback, no progress.
 */

export const MIN_JOURNEY_STOPS = 3;

export type JourneyStopKind = 'destination' | 'culture_item' | 'culture_material';

export type JourneyStop = {
  /** `<contentType>:<id>` - the same Audio Guide key the detail page uses,
   * so recordings in contentAudio apply here too. */
  key: string;
  kind: JourneyStopKind;
  id: string;
  title: string;
  narration: Narration;
  route: string;
};

export type RegionAudioJourney = { regionId: string; stops: JourneyStop[] };

/** A stop is meaningful only when there is text to read IN the app
 * language (or a recording for it) - a RU/EN listener is never handed a
 * Kyrgyz-only stop that would play nothing. */
function meaningful(narration: Narration | null, appLanguage: SupportedLanguage, hasRecording: boolean): narration is Narration {
  if (!narration) return false;
  if (hasRecording) return true;
  return narration.text.trim().length > 0 && narration.lang === appLanguage;
}

export function buildRegionAudioJourney(
  config: RegionExperienceConfig,
  content: { places: readonly ExploreRegionRow[]; cultureItems: readonly CultureItemRow[]; materials: readonly CultureMaterialRow[] },
  options: { language: SupportedLanguage; depth: ContentDepth; isChild: boolean; hasRecording?: (key: string) => boolean },
): RegionAudioJourney | null {
  const { language, depth, isChild } = options;
  const hasRecording = options.hasRecording ?? (() => false);
  const stops: JourneyStop[] = [];
  const seen = new Set<string>();
  const push = (stop: Omit<JourneyStop, 'narration'>, narration: Narration | null) => {
    if (seen.has(stop.key) || !meaningful(narration, language, hasRecording(stop.key))) return;
    seen.add(stop.key);
    stops.push({ ...stop, narration });
  };

  for (const id of config.destinationIds) {
    const row = content.places.find((candidate) => candidate.id === id);
    if (!row) continue;
    const name = mapExploreRegionName(row);
    const narration = placeNarration({ name, tagline: regionTagline(row, language), facts: row.facts ?? [], factsTranslation: row.factsTranslation }, language, isChild);
    push({ key: `region:${id}`, kind: 'destination', id, title: name[language] ?? row.name_kg, route: `/explore/${id}` }, narration);
  }
  for (const id of config.cultureItemIds) {
    const item = content.cultureItems.find((candidate) => candidate.id === id);
    if (!item) continue;
    push({ key: `culture_item:${id}`, kind: 'culture_item', id, title: item.title, route: `/culture/item/${id}` }, cultureItemNarration(item, language, depth));
  }
  for (const id of config.materialIds) {
    const material = content.materials.find((candidate) => candidate.id === id);
    if (!material) continue;
    push({ key: `culture_material:${id}`, kind: 'culture_material', id, title: material.title, route: `/culture/material/${id}` }, materialNarration(material, language));
  }

  return stops.length >= MIN_JOURNEY_STOPS ? { regionId: config.id, stops } : null;
}

export function regionAudioRoute(regionId: string): string {
  return `/explore/region/${regionId}/audio`;
}

export type JourneyProgress = { current: string | null; listened: string[] };

/**
 * Where to resume: the saved stop if it still exists in the journey,
 * else the first stop not yet listened to, else the first stop. Resume is
 * per STOP - a stop always starts from its beginning.
 */
export function resumeStopIndex(journey: RegionAudioJourney, progress: JourneyProgress | undefined): number {
  if (progress?.current) {
    const index = journey.stops.findIndex((stop) => stop.key === progress.current);
    if (index >= 0) return index;
  }
  const firstNew = journey.stops.findIndex((stop) => !progress?.listened.includes(stop.key));
  return firstNew >= 0 ? firstNew : 0;
}

/** Listened stops that are still part of the journey (an editor may have
 * removed some). */
export function listenedCount(journey: RegionAudioJourney, progress: JourneyProgress | undefined): number {
  return journey.stops.filter((stop) => progress?.listened.includes(stop.key)).length;
}
