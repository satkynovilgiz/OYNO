export type SearchableKind = 'region' | 'nature' | 'discovery';

export type SearchItem = {
  id: string;
  kind: SearchableKind;
  names: { kg: string; ru: string; en: string };
};

export function normalizeSearchQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function matchesQuery(item: SearchItem, normalizedQuery: string): boolean {
  if (!normalizedQuery) return false;
  return Object.values(item.names).some((name) => name.toLowerCase().includes(normalizedQuery));
}

/** Client-side substring search over the already-loaded region/nature/
 * discovery content - no Places or Animals catalog exists to search yet
 * (see the Explore 2.0 plan's audit section). */
export function searchExploreContent(items: SearchItem[], query: string): SearchItem[] {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) return [];
  return items.filter((item) => matchesQuery(item, normalized));
}

export function groupSearchResults(items: SearchItem[]): Record<SearchableKind, SearchItem[]> {
  const groups: Record<SearchableKind, SearchItem[]> = { region: [], nature: [], discovery: [] };
  for (const item of items) {
    groups[item.kind].push(item);
  }
  return groups;
}
