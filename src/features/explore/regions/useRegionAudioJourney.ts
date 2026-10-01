import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { SupportedLanguage } from '@/i18n';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { recordedAudioFor } from '@/services/audioGuide/contentAudio';
import { useCultureMaterials } from '@/services/content/cultureService';
import { useAllCultureItems } from '@/services/content/cultureItemsService';
import { useExploreRegions } from '@/services/content/exploreService';
import { isWaitingForNetwork } from '@/services/offline/offlineManifest';

import { buildRegionAudioJourney, type RegionAudioJourney } from './regionAudioJourney';
import type { RegionExperienceConfig } from './regionExperiences';

/** The region's audio journey in the app language, or null when it has
 * fewer than 3 stops that can actually be listened to. */
export function useRegionAudioJourney(config: RegionExperienceConfig | null): { journey: RegionAudioJourney | null; isLoading: boolean; waitingForNetwork: boolean; retry: () => void } {
  const { i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const { config: age } = useAgeExperience();
  const places = useExploreRegions();
  const items = useAllCultureItems();
  const materials = useCultureMaterials();
  const isLoading = places.isLoading || items.isLoading || materials.isLoading;

  const journey = useMemo(() => {
    if (!config) return null;
    return buildRegionAudioJourney(
      config,
      { places: places.data ?? [], cultureItems: items.data ?? [], materials: materials.data ?? [] },
      { language, depth: age.learningDepth, isChild: age.textComplexity === 'minimal', hasRecording: (key) => !!recordedAudioFor(key, language) },
    );
  }, [config, places.data, items.data, materials.data, language, age.learningDepth, age.textComplexity]);

  // Offline with nothing cached: say so - never "no journey".
  const waitingForNetwork = isWaitingForNetwork(places) || isWaitingForNetwork(items) || isWaitingForNetwork(materials);
  const retry = () => {
    void places.refetch();
    void items.refetch();
    void materials.refetch();
  };
  return { journey, isLoading, waitingForNetwork, retry };
}
