import type { ImageSourcePropType } from 'react-native';

import type { TranslationStatus } from '@/services/content/localizedContent';
import type { CultureAccuracyLevel, CultureCategoryRow, CultureItemRow, CultureMaterialRow } from '@/services/content/types';

/**
 * Culture Gallery - explore by image. Entries are REFERENCES to existing
 * culture items/materials that have a real approved image and a working
 * route; title, image, category, preview text and verification are all
 * resolved from the existing content. Nothing is generated, captioned or
 * copied into a second database. (No image-origin metadata exists in the
 * app, so no "photo / illustration" label is invented either.)
 */

export type GalleryEntry = {
  key: string;
  contentType: 'culture_item' | 'culture_material';
  contentId: string;
  title: string;
  /** Existing culture category (items); null for materials. */
  categoryId: string | null;
  image: ImageSourcePropType;
  /** True when the image is a bundled asset (works offline). */
  bundledImage: boolean;
  route: string;
  accuracy: CultureAccuracyLevel;
  sources: string[] | null;
  /** Short EXISTING authored text for the preview (or null). */
  context: string | null;
  /** Language status of `context`, for the honest Kyrgyz-fallback note. */
  translationStatus: TranslationStatus | undefined;
};

export const MATERIALS_FILTER = 'materials';

function simpleSummary(item: CultureItemRow, language: string): string | null {
  const value = language === 'ru' ? item.simple_summary_ru : language === 'en' ? item.simple_summary_en : item.simple_summary_kg;
  return value?.trim() || null;
}

/**
 * Preview text rule: an item's simple summary in the app language if one
 * is authored, else its authored cultural_meaning; a material's authored
 * description. Never a summary of our own.
 */
export function previewContext(item: CultureItemRow, language: string): string | null {
  return simpleSummary(item, language) ?? (item.cultural_meaning?.trim() || null);
}

export function buildGallery(input: {
  items: readonly CultureItemRow[] | undefined;
  materials: readonly CultureMaterialRow[] | undefined;
  categories: readonly CultureCategoryRow[] | undefined;
  itemImages: Record<string, ImageSourcePropType[] | undefined>;
  materialImages: Record<string, ImageSourcePropType | undefined>;
  language: string;
  /** Offline: entries whose only image is remote are skipped. */
  offline: boolean;
}): GalleryEntry[] {
  const seen = new Set<string>();
  const entries: GalleryEntry[] = [];
  const categoryOrder = new Map((input.categories ?? []).map((category, index) => [category.id, index]));
  const items = [...(input.items ?? [])].sort((a, b) => (categoryOrder.get(a.category_id) ?? 999) - (categoryOrder.get(b.category_id) ?? 999) || a.sort_order - b.sort_order || a.id.localeCompare(b.id));
  for (const item of items) {
    const bundled = input.itemImages[item.id]?.[0];
    const image = bundled ?? (item.image_url ? { uri: item.image_url } : null);
    const key = `culture_item:${item.id}`;
    if (!image || seen.has(key) || (input.offline && !bundled)) continue;
    seen.add(key);
    entries.push({
      key,
      contentType: 'culture_item',
      contentId: item.id,
      title: item.title,
      categoryId: item.category_id,
      image,
      bundledImage: !!bundled,
      route: `/culture/item/${item.id}`,
      accuracy: item.accuracy_level,
      sources: item.sources,
      context: previewContext(item, input.language),
      translationStatus: simpleSummary(item, input.language) ? undefined : item.translation?.status,
    });
  }
  for (const material of [...(input.materials ?? [])].sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id))) {
    const bundled = input.materialImages[material.id];
    const image = bundled ?? (material.image_url ? { uri: material.image_url } : null);
    const key = `culture_material:${material.id}`;
    if (!image || seen.has(key) || material.kind === 'today_discovery' || (input.offline && !bundled)) continue;
    seen.add(key);
    entries.push({
      key,
      contentType: 'culture_material',
      contentId: material.id,
      title: material.title,
      categoryId: null,
      image,
      bundledImage: !!bundled,
      route: `/culture/material/${material.id}`,
      accuracy: material.accuracy_level,
      sources: material.sources,
      context: material.description?.trim() || null,
      translationStatus: material.translation?.status,
    });
  }
  return entries;
}

/** Filters derived from the categories that really have gallery entries
 * (in the categories' own order), plus Materials when any exist. Counts
 * are the current entries. */
export function galleryFilters(entries: readonly GalleryEntry[], categories: readonly CultureCategoryRow[] | undefined): { id: string; count: number }[] {
  const filters = (categories ?? []).map((category) => ({ id: category.id, count: entries.filter((entry) => entry.categoryId === category.id).length })).filter((filter) => filter.count > 0);
  const materials = entries.filter((entry) => entry.contentType === 'culture_material').length;
  return materials > 0 ? [...filters, { id: MATERIALS_FILTER, count: materials }] : filters;
}

export function filterGallery(entries: readonly GalleryEntry[], filter: string): GalleryEntry[] {
  if (filter === 'all') return [...entries];
  if (filter === MATERIALS_FILTER) return entries.filter((entry) => entry.contentType === 'culture_material');
  return entries.filter((entry) => entry.categoryId === filter);
}

/** Previous / next within the CURRENT filtered order - stops at the ends. */
export function neighbour(length: number, index: number, delta: -1 | 1): number | null {
  const next = index + delta;
  return next >= 0 && next < length ? next : null;
}

/** Tile height ratio from the image's real proportions (bundled assets
 * report them), kept within a range so the grid stays calm. */
export function tileAspect(width: number | undefined, height: number | undefined): number {
  if (!width || !height) return 0.8;
  return Math.min(1.4, Math.max(0.7, width / height));
}

/** Grid presentation per age: same entries, different density. */
export const GALLERY_PRESENTATION: Record<'child' | 'preteen' | 'teen' | 'adult', { columns: number; showCategory: boolean; editorial: boolean }> = {
  child: { columns: 1, showCategory: false, editorial: false },
  preteen: { columns: 2, showCategory: true, editorial: false },
  teen: { columns: 2, showCategory: true, editorial: false },
  adult: { columns: 2, showCategory: true, editorial: true },
};
