import type { ImageSourcePropType } from 'react-native';

import { cultureCategoryImages, cultureItemImages, cultureMaterialImages } from '@/features/culture/data';
import type { CultureCategoryId } from '@/features/culture/types';
import { natureSiteImages } from '@/features/explore/data';
import { gameArt } from '@/features/games/gamesCatalog';
import { INTERACTIVE_EXPERIENCES, routeForInteractiveExperience } from '@/features/culture/interactiveExperiences';
import { gameTitleKey, type GameListItem } from '@/features/games/types';
import type { Collection } from '@/features/collections/collectionsData';
import type { Trail } from '@/features/trails/trailsData';
import type { SupportedLanguage } from '@/i18n';
import { cultureCategoryTitle } from '@/services/content/cultureCategoryTitles';
import { regionTagline } from '@/services/content/regionTaglines';
import { mapExploreRegionName, type CultureCategoryRow, type CultureItemRow, type CultureMaterialRow, type ExploreRegionRow } from '@/services/content/types';

/**
 * One normalized shape for "a piece of real OYNO content that can be
 * searched and/or saved" - built from the app's existing data sources
 * (games mock list, Culture/Explore Supabase tables, the static
 * interactive-experiences list), never a second copy of that content
 * (spec "Do NOT duplicate content. Use the existing repositories/data
 * sources" - repeated verbatim across the Search and Favorites tasks).
 * Shared by both features so there's exactly one place that knows how to
 * turn each content type into a title/thumbnail/route, instead of Search
 * and Saved each re-deriving it slightly differently.
 */
export type CatalogContentType = 'game' | 'region' | 'nature' | 'culture_category' | 'culture_material' | 'culture_item' | 'interactive_experience' | 'trail' | 'collection';

export type CatalogItem = {
  contentType: CatalogContentType;
  id: string;
  title: string;
  /** Short secondary line - a game's category/duration, a culture item's
   * parent category, a material's kind, etc. Never fabricated when the
   * source has nothing meaningful to show. */
  metadata: string | null;
  thumbnail: ImageSourcePropType | null;
  route: string | null;
  /** Every string worth matching a search query against - `title` alone
   * for content whose source has just one authored string (Culture
   * categories/items/materials aren't split per-locale at the DB level
   * yet), or the kg+ru+en variants for anything that genuinely has them
   * (Explore regions, and i18n-key-driven titles resolved in all three
   * languages), so a query typed in a different script than the current
   * UI language still finds it - same intent as the existing
   * `services/explore/search.ts`, generalized to every content type. */
  searchText: string[];
};

type TFunction = (key: string, options?: { lng?: SupportedLanguage }) => string;

const LANGUAGES: SupportedLanguage[] = ['kg', 'ru', 'en'];

function resolveLocalized(text: { kg: string; ru: string; en: string }, language: SupportedLanguage): string {
  return text[language] ?? text.kg;
}

function allLanguageValues(t: TFunction, key: string): string[] {
  return LANGUAGES.map((lng) => t(key, { lng }));
}

export function buildGameCatalog(games: GameListItem[], t: TFunction): CatalogItem[] {
  return games.map((game) => ({
    contentType: 'game',
    id: game.id,
    title: t(gameTitleKey(game.id)),
    metadata: t(`games.categories.${game.category}`),
    // The same art the Games tab uses (incl. large-format art for games
    // without a thumbnail, e.g. Kok Boru).
    thumbnail: gameArt(game, 'card'),
    route: game.route ?? null,
    searchText: allLanguageValues(t, gameTitleKey(game.id)),
  }));
}

export function buildCultureCategoryCatalog(categories: CultureCategoryRow[], language: SupportedLanguage = 'kg'): CatalogItem[] {
  return categories.map((category) => ({
    contentType: 'culture_category',
    id: category.id,
    // The DB title is Kyrgyz-only; RU/EN come from the reviewed overlay
    // (cultureCategoryTitles.ts). Search matches all three.
    title: cultureCategoryTitle(category, language),
    metadata: null,
    thumbnail: cultureCategoryImages[category.id as CultureCategoryId] ?? null,
    route: category.id === 'games' ? '/games' : `/culture/${category.id}`,
    searchText: Array.from(new Set(LANGUAGES.map((lng) => cultureCategoryTitle(category, lng)))),
  }));
}

export function buildCultureItemCatalog(items: CultureItemRow[], categories: CultureCategoryRow[], language: SupportedLanguage = 'kg'): CatalogItem[] {
  const categoryTitleById = new Map(categories.map((category) => [category.id, cultureCategoryTitle(category, language)]));
  return items.map((item) => ({
    contentType: 'culture_item',
    id: item.id,
    title: item.title,
    metadata: categoryTitleById.get(item.category_id) ?? null,
    thumbnail: cultureItemImages[item.id]?.[0] ?? null,
    route: `/culture/item/${item.id}`,
    // Every language's title that exists (KG canonical + reviewed RU/EN
    // translations) plus real alternate names - a translation added in
    // the database is searchable immediately, no second index.
    searchText: uniqueText([...Object.values(item.translation?.titles ?? { kg: item.title }), item.title, item.alt_names]),
  }));
}

function uniqueText(values: (string | null | undefined)[]): string[] {
  return Array.from(new Set(values.filter((value): value is string => !!value?.trim())));
}

export function buildCultureMaterialCatalog(materials: CultureMaterialRow[]): CatalogItem[] {
  return materials.map((material) => ({
    contentType: 'culture_material',
    id: material.id,
    title: material.title,
    metadata: material.duration_minutes ? `${material.duration_minutes} min` : null,
    thumbnail: cultureMaterialImages[material.id] ?? null,
    route: `/culture/material/${material.id}`,
    searchText: uniqueText([...Object.values(material.translation?.titles ?? {}), material.title]),
  }));
}

export function buildExploreCatalog(regions: ExploreRegionRow[], language: SupportedLanguage): CatalogItem[] {
  return regions.map((region) => {
    const name = mapExploreRegionName(region);
    return {
      contentType: region.kind,
      id: region.id,
      title: resolveLocalized(name, language),
      metadata: regionTagline(region, language) || null,
      // Real photos exist for nature sites; regions keep the tonal fallback.
      thumbnail: natureSiteImages[region.id] ?? null,
      route: `/explore/${region.id}`,
      searchText: [name.kg, name.ru, name.en],
    };
  });
}

export function buildInteractiveExperienceCatalog(t: TFunction): CatalogItem[] {
  return INTERACTIVE_EXPERIENCES.map((experience) => ({
    contentType: 'interactive_experience',
    id: experience.id,
    title: t(experience.titleKey),
    metadata: null,
    thumbnail: experience.imageSource,
    route: routeForInteractiveExperience(experience.id),
    searchText: allLanguageValues(t, experience.titleKey),
  }));
}

/** Guided Trails as search results. `metadata` is supplied by the caller
 * (real progress like "3/5 completed" only when the trail has trackable
 * progress) so this builder never computes progress itself. */
export function buildTrailCatalog(trails: Trail[], language: SupportedLanguage, metadataFor: (trail: Trail) => string | null): CatalogItem[] {
  return trails.map((trail) => ({
    contentType: 'trail',
    id: trail.id,
    title: resolveLocalized(trail.title, language),
    metadata: metadataFor(trail),
    thumbnail: trail.heroImage,
    route: `/trails/${trail.id}`,
    searchText: [trail.title.kg, trail.title.ru, trail.title.en],
  }));
}

/** Culture collections (static, localized) - searchable like trails. */
export function buildCollectionCatalog(collections: Collection[], language: SupportedLanguage, label: string | null): CatalogItem[] {
  return collections.map((collection) => ({
    contentType: 'collection',
    id: collection.id,
    title: resolveLocalized(collection.title, language),
    metadata: label,
    thumbnail: collection.heroImage,
    route: `/collections/${collection.id}`,
    searchText: [collection.title.kg, collection.title.ru, collection.title.en],
  }));
}
