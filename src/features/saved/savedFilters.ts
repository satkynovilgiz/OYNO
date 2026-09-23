import type { CatalogContentType, CatalogItem } from '@/services/content/contentCatalog';
import type { FavoriteContentType } from '@/store/useFavoritesStore';

/** The filter chips on the Saved screen (spec "Баары / All, Оюндар /
 * Games, Маданият / Culture, Жерлер / Places") - fewer, coarser buckets
 * than Search's 4 groups (Culture here also absorbs Materials - there's
 * no separate "Materials" chip in this screen's own spec). */
export type SavedFilter = 'all' | 'games' | 'culture' | 'places';

const FILTER_BY_CONTENT_TYPE: Record<FavoriteContentType, SavedFilter> = {
  game: 'games',
  culture_material: 'culture',
  culture_item: 'culture',
  interactive_experience: 'culture',
  region: 'places',
  nature: 'places',
};

export function filterForContentType(contentType: CatalogContentType): SavedFilter | null {
  // Categories and trails aren't favoritable (trails: see useFavoritesStore
  // - the favorites table/RPC only accepts its existing content types).
  if (contentType === 'culture_category' || contentType === 'trail') return null;
  return FILTER_BY_CONTENT_TYPE[contentType];
}

export function filterSavedItems(items: CatalogItem[], filter: SavedFilter): CatalogItem[] {
  if (filter === 'all') return items;
  return items.filter((item) => filterForContentType(item.contentType) === filter);
}

/** Resolves a favorited (contentType, id) list into the matching catalog
 * entries, most-recently-saved first - `favoriteIds` only ever appends,
 * so reversing it is the recency order without needing a separate
 * timestamp per entry. Anything favorited that no longer resolves to a
 * real catalog item (deleted content) is silently dropped rather than
 * shown as a broken row. */
export function resolveSavedItems(favoriteKeys: string[], catalog: CatalogItem[]): CatalogItem[] {
  const catalogByKey = new Map(catalog.map((item) => [`${item.contentType}:${item.id}`, item]));
  return [...favoriteKeys]
    .reverse()
    .map((key) => catalogByKey.get(key))
    .filter((item): item is CatalogItem => !!item);
}
