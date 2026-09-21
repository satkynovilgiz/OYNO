import type { CatalogContentType, CatalogItem } from '@/services/content/contentCatalog';

/** The 4 result groups the search screen renders under (spec "Оюндар /
 * Games, Маданият / Culture, Жерлер / Places, Материалдар / Materials") -
 * a display grouping over `CatalogContentType`, not a new content
 * classification of its own. */
export type SearchResultGroup = 'games' | 'culture' | 'places' | 'materials';

const GROUP_BY_CONTENT_TYPE: Record<CatalogContentType, SearchResultGroup> = {
  game: 'games',
  culture_category: 'culture',
  culture_item: 'culture',
  interactive_experience: 'culture',
  culture_material: 'materials',
  region: 'places',
  nature: 'places',
};

export function groupForContentType(contentType: CatalogContentType): SearchResultGroup {
  return GROUP_BY_CONTENT_TYPE[contentType];
}

/** Same normalization as the existing `services/explore/search.ts` -
 * trim + lowercase, no fuzzy/Levenshtein matching anywhere in this
 * codebase to diverge from. */
export function normalizeSearchQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function matchesQuery(item: CatalogItem, normalizedQuery: string): boolean {
  if (!normalizedQuery) return false;
  return item.searchText.some((text) => text.toLowerCase().includes(normalizedQuery));
}

/** Content with no working destination yet (a game with no route built,
 * an interactive experience somehow missing its route map entry) is
 * excluded rather than shown as a dead result row - spec "Tapping a
 * result must navigate to the REAL existing detail screen." */
export function searchCatalog(items: CatalogItem[], query: string): CatalogItem[] {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) return [];
  return items.filter((item) => !!item.route && matchesQuery(item, normalized));
}

export function groupSearchResults(items: CatalogItem[]): Record<SearchResultGroup, CatalogItem[]> {
  const groups: Record<SearchResultGroup, CatalogItem[]> = { games: [], culture: [], places: [], materials: [] };
  for (const item of items) {
    groups[groupForContentType(item.contentType)].push(item);
  }
  return groups;
}
