import type { RecentEntry } from '@/features/home/homeRecommendation';
import type { CatalogContentType, CatalogItem } from '@/services/content/contentCatalog';
import type { FavoriteContentType } from '@/store/useFavoritesStore';

/**
 * Saved - pure view model over the ONE favorites list (useFavoritesStore)
 * and the shared content catalog. Nothing here writes favorites, touches
 * sync, or reads the offline manifest beyond "is this id downloaded".
 *
 * Sections are the favoritable content types, grouped for people:
 *   places   region, nature
 *   culture  culture_item, culture_material, interactive_experience
 *   games    game
 * Collections and trails are NOT favoritable (the user_favorites RPC only
 * accepts the types above), so they never get a Saved section.
 *
 * Order: favorites carry no per-item saved timestamp on the device (after
 * an account sync the list is the server's unordered set plus pending
 * edits), so "recently saved first" can't be told honestly. Items keep
 * the deterministic catalog order instead - the same order the content
 * has everywhere else in OYNO.
 */
export type SavedSection = 'places' | 'culture' | 'games';

export const SAVED_SECTION_ORDER: SavedSection[] = ['places', 'culture', 'games'];

const SECTION_BY_TYPE: Record<FavoriteContentType, SavedSection> = {
  region: 'places',
  nature: 'places',
  culture_item: 'culture',
  culture_material: 'culture',
  interactive_experience: 'culture',
  game: 'games',
};

export function savedSectionFor(contentType: CatalogContentType): SavedSection | null {
  return SECTION_BY_TYPE[contentType as FavoriteContentType] ?? null;
}

export type SavedEntry = { key: string; item: CatalogItem; offline: boolean };

export type SavedView = {
  total: number;
  offlineCount: number;
  sections: { id: SavedSection; entries: SavedEntry[] }[];
  /** Saved items the user also explored recently (real visit / Daily
   * completion dates only), newest first, max 4. Never auto-saves. */
  continueExploring: SavedEntry[];
};

export const CONTINUE_LIMIT = 4;
/** Filters only help once the list is long and mixed. */
export const FILTER_MIN_ITEMS = 6;

function catalogKey(item: CatalogItem): string {
  return `${item.contentType}:${item.id}`;
}

/** The catalog key a recently-explored entry refers to, if any. */
function recentKeys(entry: RecentEntry): string[] {
  return entry.kind === 'place' ? [`nature:${entry.id}`, `region:${entry.id}`] : [`culture_item:${entry.id}`];
}

export function buildSavedView({
  favoriteIds,
  catalog,
  isOffline,
  recent,
}: {
  favoriteIds: string[];
  catalog: CatalogItem[];
  /** Whether a complete offline copy exists for this item. */
  isOffline: (item: CatalogItem) => boolean;
  /** Real recently-explored entries, newest first. */
  recent: RecentEntry[];
}): SavedView {
  const saved = new Set(favoriteIds);
  const seen = new Set<string>();
  const entries: SavedEntry[] = [];
  for (const item of catalog) {
    const key = catalogKey(item);
    // Only real, routable content the user actually saved; anything whose
    // content was removed simply doesn't resolve (never a broken row).
    if (!saved.has(key) || seen.has(key) || !item.route || !savedSectionFor(item.contentType)) continue;
    seen.add(key);
    entries.push({ key, item, offline: isOffline(item) });
  }

  const sections = SAVED_SECTION_ORDER.map((id) => ({ id, entries: entries.filter((entry) => savedSectionFor(entry.item.contentType) === id) })).filter((section) => section.entries.length > 0);

  const byKey = new Map(entries.map((entry) => [entry.key, entry]));
  const continueExploring: SavedEntry[] = [];
  for (const entry of recent) {
    for (const key of recentKeys(entry)) {
      const match = byKey.get(key);
      if (match && !continueExploring.includes(match)) continueExploring.push(match);
    }
    if (continueExploring.length >= CONTINUE_LIMIT) break;
  }

  return {
    total: entries.length,
    offlineCount: entries.filter((entry) => entry.offline).length,
    sections,
    continueExploring: continueExploring.slice(0, CONTINUE_LIMIT),
  };
}

export type SavedFilter = 'all' | SavedSection;

/** Filter chips: All + only the sections that really exist, and only when
 * the list is long and mixed enough for filtering to help. */
export function savedFilterOptions(view: SavedView): SavedFilter[] {
  if (view.total < FILTER_MIN_ITEMS || view.sections.length < 2) return [];
  return ['all', ...view.sections.map((section) => section.id)];
}

export function visibleSections(view: SavedView, filter: SavedFilter): SavedView['sections'] {
  return filter === 'all' ? view.sections : view.sections.filter((section) => section.id === filter);
}
