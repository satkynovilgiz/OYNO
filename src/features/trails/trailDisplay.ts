import type { ImageSourcePropType } from 'react-native';

import { getCollection } from '@/features/collections/collectionsData';
import { cultureItemImages, cultureMaterialImages } from '@/features/culture/data';
import { INTERACTIVE_EXPERIENCES, routeForInteractiveExperience } from '@/features/culture/interactiveExperiences';
import { natureSiteImages } from '@/features/explore/data';
import { mockGamesList } from '@/features/games/mockData';
import { gameTitleKey } from '@/features/games/types';
import type { SupportedLanguage } from '@/i18n';
import { mapExploreRegionName, type CultureItemRow, type CultureMaterialRow, type ExploreRegionRow } from '@/services/content/types';

import type { TrailStepRef } from './trailsData';

export type TrailStepDisplay = {
  title: string;
  /** i18n key of the small type label ("Place", "Game", ...). */
  typeLabelKey: string;
  imageSource: ImageSourcePropType | null;
  /** The EXISTING screen for this content, or null if it can't open. */
  route: string | null;
};

type DisplaySources = {
  regions: ExploreRegionRow[];
  cultureItems: CultureItemRow[];
  cultureMaterials: CultureMaterialRow[];
};

type TFunction = (key: string) => string;

export function routeForTrailStep(step: TrailStepRef): string | null {
  switch (step.type) {
    case 'destination':
      return `/explore/${step.id}`;
    case 'culture_item':
      return `/culture/item/${step.id}`;
    case 'culture_material':
      return `/culture/material/${step.id}`;
    case 'interactive_experience':
      return routeForInteractiveExperience(step.id);
    case 'game':
      return mockGamesList.find((game) => game.id === step.id)?.route ?? null;
    case 'collection':
      return `/collections/${step.id}`;
  }
}

/** Title/photo/label for a step, read from the existing content sources -
 * a step whose content hasn't loaded yet gets an empty title rather than
 * made-up text. */
export function resolveTrailStep(step: TrailStepRef, sources: DisplaySources, t: TFunction, language: SupportedLanguage): TrailStepDisplay {
  const route = routeForTrailStep(step);
  switch (step.type) {
    case 'destination': {
      const row = sources.regions.find((region) => region.id === step.id);
      const name = row ? mapExploreRegionName(row) : null;
      return { title: name ? (name[language] ?? name.kg) : '', typeLabelKey: 'trails.stepTypes.destination', imageSource: natureSiteImages[step.id] ?? null, route };
    }
    case 'culture_item':
      return {
        title: sources.cultureItems.find((item) => item.id === step.id)?.title ?? '',
        typeLabelKey: 'trails.stepTypes.culture_item',
        imageSource: cultureItemImages[step.id]?.[0] ?? null,
        route,
      };
    case 'culture_material':
      return {
        title: sources.cultureMaterials.find((material) => material.id === step.id)?.title ?? '',
        typeLabelKey: 'trails.stepTypes.culture_material',
        imageSource: cultureMaterialImages[step.id] ?? null,
        route,
      };
    case 'interactive_experience': {
      const experience = INTERACTIVE_EXPERIENCES.find((entry) => entry.id === step.id);
      return { title: experience ? t(experience.titleKey) : '', typeLabelKey: 'trails.stepTypes.interactive_experience', imageSource: experience?.imageSource ?? null, route };
    }
    case 'game': {
      const game = mockGamesList.find((entry) => entry.id === step.id);
      return { title: game ? t(gameTitleKey(game.id)) : '', typeLabelKey: 'trails.stepTypes.game', imageSource: game?.thumbnail ?? null, route };
    }
    case 'collection': {
      const collection = getCollection(step.id);
      return {
        title: collection ? (collection.title[language] ?? collection.title.kg) : '',
        typeLabelKey: 'trails.stepTypes.collection',
        imageSource: collection?.heroImage ?? null,
        route,
      };
    }
  }
}
