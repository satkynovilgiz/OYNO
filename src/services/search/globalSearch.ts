import type { CatalogContentType, CatalogItem } from '@/services/content/contentCatalog';

/**
 * Global Search over the ONE shared content catalog (contentCatalog.ts) -
 * places, culture, collections, trails and games. Local, synchronous and
 * deterministic: no AI, no network, no second index. Private notes are
 * not a catalog type at all, so they can never be matched.
 */
export type SearchResultGroup = 'places' | 'culture' | 'collections' | 'trails' | 'games';

/** Display order when two groups rank equally. */
export const SEARCH_GROUP_ORDER: SearchResultGroup[] = ['places', 'culture', 'collections', 'trails', 'games'];

const GROUP_BY_CONTENT_TYPE: Record<CatalogContentType, SearchResultGroup> = {
  region: 'places',
  nature: 'places',
  culture_category: 'culture',
  culture_item: 'culture',
  culture_material: 'culture',
  interactive_experience: 'culture',
  collection: 'collections',
  trail: 'trails',
  game: 'games',
};

export function groupForContentType(contentType: CatalogContentType): SearchResultGroup {
  return GROUP_BY_CONTENT_TYPE[contentType];
}

/** Trim + Unicode NFC + lowercase. NFC: a letter such as "й" can arrive
 * precomposed or as base letter + combining mark (pasted text, some
 * keyboards) - both must compare equal. Also used by the link-content
 * sheet, so it stays a plain normalization (no letter folding). */
export function normalizeSearchQuery(query: string): string {
  return query.normalize('NFC').trim().toLowerCase();
}

/**
 * Matching form: normalized, then a small fixed, length-preserving fold -
 *   ө→о  ү→у  ң→н   many people type Kyrgyz on a Russian layout
 *   ӧ→о  ӱ→у        lookalikes from other Turkic keyboards
 *   ё→е             common Russian spelling variance
 *   - – — _ → space  "Ысык-Көл" = "ысык көл"
 * Deterministic and 1:1 per character (so match positions map straight
 * back onto the displayed title for highlighting). No fuzzy/edit-distance
 * matching: it returned unrelated content for short queries.
 */
export function foldSearchText(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[өӧ]/g, 'о')
    .replace(/[үӱ]/g, 'у')
    .replace(/ң/g, 'н')
    .replace(/ё/g, 'е')
    .replace(/[-‐‑–—_]/g, ' ');
}

function foldQuery(query: string): string {
  return foldSearchText(query.trim()).replace(/\s+/g, ' ');
}

const WORD_BOUNDARY = /[\s"«»“”'()(),.:;/]/;

function startsWord(text: string, query: string): boolean {
  let index = text.indexOf(query);
  while (index > 0) {
    if (WORD_BOUNDARY.test(text[index - 1])) return true;
    index = text.indexOf(query, index + 1);
  }
  return index === 0;
}

/** Ranking tiers (higher first). Alternate names = the other-language
 * titles and stored alternate spellings already in `searchText`. */
export const MATCH_SCORE = {
  exact: 600,
  prefix: 500,
  wordPrefix: 400,
  contains: 300,
  altExact: 250,
  altPrefix: 220,
  altContains: 180,
  metadata: 50,
} as const;

function tierFor(text: string, query: string): 'exact' | 'prefix' | 'wordPrefix' | 'contains' | null {
  if (text === query) return 'exact';
  if (text.startsWith(query)) return 'prefix';
  if (startsWord(text, query)) return 'wordPrefix';
  if (text.includes(query)) return 'contains';
  return null;
}

/** Only a category-like secondary line is worth a weak match (a culture
 * item's category, a game's genre) - never durations or progress text. */
const METADATA_MATCH_TYPES: CatalogContentType[] = ['culture_item', 'game'];

/** 0 = no match. */
export function scoreMatch(item: CatalogItem, query: string): number {
  const q = foldQuery(query);
  if (!q) return 0;
  const title = foldSearchText(item.title);
  const titleTier = tierFor(title, q);
  if (titleTier) return MATCH_SCORE[titleTier];

  let best = 0;
  for (const alt of item.searchText) {
    const tier = tierFor(foldSearchText(alt), q);
    if (tier === 'exact') best = Math.max(best, MATCH_SCORE.altExact);
    else if (tier === 'prefix' || tier === 'wordPrefix') best = Math.max(best, MATCH_SCORE.altPrefix);
    else if (tier === 'contains') best = Math.max(best, MATCH_SCORE.altContains);
  }
  if (best) return best;

  if (q.length >= 3 && item.metadata && METADATA_MATCH_TYPES.includes(item.contentType) && foldSearchText(item.metadata).includes(q)) return MATCH_SCORE.metadata;
  return 0;
}

export function matchesQuery(item: CatalogItem, query: string): boolean {
  return scoreMatch(item, query) > 0;
}

export type RankedResult = { item: CatalogItem; score: number };

/**
 * Ranked results: exact title > title prefix > word prefix > contains >
 * other-language / alternate names > weak metadata. Ties keep catalog
 * order (stable - never random). Content with no working destination is
 * excluded rather than shown as a dead row.
 */
export function rankSearchResults(items: CatalogItem[], query: string): RankedResult[] {
  if (!foldQuery(query)) return [];
  const seen = new Set<string>();
  const ranked: (RankedResult & { index: number })[] = [];
  items.forEach((item, index) => {
    const key = `${item.contentType}:${item.id}`;
    if (!item.route || seen.has(key)) return;
    const score = scoreMatch(item, query);
    if (score > 0) {
      seen.add(key);
      ranked.push({ item, score, index });
    }
  });
  return ranked.sort((a, b) => b.score - a.score || a.index - b.index).map(({ item, score }) => ({ item, score }));
}

export function searchCatalog(items: CatalogItem[], query: string): CatalogItem[] {
  return rankSearchResults(items, query).map((result) => result.item);
}

export type SearchGroupResult = { id: SearchResultGroup; items: CatalogItem[]; topScore: number };

/** Non-empty groups only, the group holding the best match first (typing
 * "Ордо" puts Games on top); equal groups keep SEARCH_GROUP_ORDER. */
export function groupRankedResults(results: RankedResult[]): SearchGroupResult[] {
  const groups = new Map<SearchResultGroup, SearchGroupResult>();
  for (const { item, score } of results) {
    const id = groupForContentType(item.contentType);
    const group = groups.get(id) ?? { id, items: [], topScore: 0 };
    group.items.push(item);
    group.topScore = Math.max(group.topScore, score);
    groups.set(id, group);
  }
  return [...groups.values()].sort((a, b) => b.topScore - a.topScore || SEARCH_GROUP_ORDER.indexOf(a.id) - SEARCH_GROUP_ORDER.indexOf(b.id));
}

/** Where the query sits inside the displayed title, for a subtle bold
 * highlight - null when the match came from an alternate name (or the
 * title can't be mapped 1:1), in which case nothing is highlighted. */
export function highlightRange(title: string, query: string): [number, number] | null {
  const q = foldQuery(query);
  if (!q) return null;
  const display = title.normalize('NFC');
  const folded = foldSearchText(display);
  if (folded.length !== display.length) return null;
  const start = folded.indexOf(q);
  return start < 0 ? null : [start, start + q.length];
}
