import * as fs from 'fs';
import * as path from 'path';

import { collections } from '@/features/collections/collectionsData';
import { trails } from '@/features/trails/trailsData';
import { buildCollectionCatalog, buildTrailCatalog, type CatalogContentType, type CatalogItem } from '@/services/content/contentCatalog';

import {
  foldSearchText,
  groupForContentType,
  groupRankedResults,
  highlightRange,
  matchesQuery,
  MATCH_SCORE,
  normalizeSearchQuery,
  rankSearchResults,
  scoreMatch,
  searchCatalog,
} from './globalSearch';

function makeItem(overrides: Partial<CatalogItem>): CatalogItem {
  return { contentType: 'game', id: 'x', title: 'X', metadata: null, thumbnail: null, route: '/x', searchText: ['X'], ...overrides };
}

const ISSYK = makeItem({ id: 'issyk-kul', contentType: 'nature', title: 'Ысык-Көл', searchText: ['Ысык-Көл', 'Иссык-Куль', 'Issyk-Kul'], route: '/explore/issyk-kul' });
const SONG = makeItem({ id: 'song-kul', contentType: 'nature', title: 'Соң-Көл', searchText: ['Соң-Көл', 'Сон-Куль', 'Song-Kul'], route: '/explore/song-kul' });
const ORDO = makeItem({ id: 'ordo', contentType: 'game', title: 'Ордо', searchText: ['Ордо', 'Ordo'], route: '/games/ordo' });
const KOMUZ = makeItem({ id: 'komuz', contentType: 'culture_item', title: 'Комуз', searchText: ['Комуз'], metadata: 'Музыка', route: '/culture/item/komuz' });
const KOMUZ_LESSON = makeItem({ id: 'komuz-learn', contentType: 'interactive_experience', title: 'Комузда ойноп үйрөн', searchText: ['Комузда ойноп үйрөн', 'Учимся играть на комузе', 'Learn the komuz'], route: '/culture/komuz/learn' });
const MUSIC_STORY = makeItem({ id: 'epic', contentType: 'culture_item', title: 'Манас эпосу', searchText: ['Манас эпосу'], metadata: 'Музыка жана эпос', route: '/culture/item/epic' });

describe('normalization', () => {
  it('trims, lowercases and NFC-normalizes (a letter typed as base + combining mark equals the composed letter)', () => {
    const decomposed = 'Кии\u0306из'; // и + combining breve = й
    expect(normalizeSearchQuery(`  ${decomposed} `)).toBe('кийиз');
    expect(normalizeSearchQuery('  Комуз  ')).toBe('комуз');
  });

  it('folds ө/ү/ң/ё and dashes 1:1 (length-preserving)', () => {
    expect(foldSearchText('Соң-Көл')).toBe('сон кол');
    expect(foldSearchText('Үй')).toBe('уй');
    expect(foldSearchText('Ӧӱ')).toBe('оу');
    expect(foldSearchText('Ёлка')).toBe('елка');
    expect(foldSearchText('Ысык-Көл')).toHaveLength('Ысык-Көл'.length);
  });
});

describe('matching', () => {
  it('KG: ң ө ү match typed exactly, and on a Russian layout without them', () => {
    expect(matchesQuery(SONG, 'Соң-Көл')).toBe(true);
    expect(matchesQuery(SONG, 'соң көл')).toBe(true);
    expect(matchesQuery(SONG, 'сон кол')).toBe(true);
    expect(matchesQuery(KOMUZ_LESSON, 'үйрөн')).toBe(true);
    expect(matchesQuery(KOMUZ_LESSON, 'уйрон')).toBe(true);
    // Lookalike letters from other Turkic alphabets (ӧ ӱ) typed for ө ү.
    expect(matchesQuery(SONG, 'кӧл')).toBe(true);
    expect(matchesQuery(makeItem({ title: 'Кийиз үй', searchText: ['Кийиз үй'] }), 'Кии\u0306из')).toBe(true);
  });

  it('RU and EN: other-language titles already stored on the item', () => {
    expect(matchesQuery(ISSYK, 'Иссык')).toBe(true);
    expect(matchesQuery(ISSYK, 'ISSYK-kul')).toBe(true);
    expect(matchesQuery(KOMUZ_LESSON, 'learn the')).toBe(true);
    expect(matchesQuery(KOMUZ_LESSON, 'учимся')).toBe(true);
  });

  it('never matches an empty or whitespace query, and no fuzzy matches', () => {
    expect(matchesQuery(ORDO, '   ')).toBe(false);
    expect(matchesQuery(ORDO, 'ордa')).toBe(false);
    expect(matchesQuery(ORDO, 'zzz')).toBe(false);
  });
});

describe('ranking', () => {
  it('exact > prefix > word prefix > contains > alternate name > metadata', () => {
    expect(scoreMatch(KOMUZ, 'комуз')).toBe(MATCH_SCORE.exact);
    expect(scoreMatch(KOMUZ, 'ком')).toBe(MATCH_SCORE.prefix);
    expect(scoreMatch(ISSYK, 'көл')).toBe(MATCH_SCORE.wordPrefix);
    expect(scoreMatch(KOMUZ, 'муз')).toBe(MATCH_SCORE.contains);
    expect(scoreMatch(ISSYK, 'issyk-kul')).toBe(MATCH_SCORE.altExact);
    expect(scoreMatch(KOMUZ_LESSON, 'learn')).toBe(MATCH_SCORE.altPrefix);
    expect(scoreMatch(MUSIC_STORY, 'музыка')).toBe(MATCH_SCORE.metadata);
  });

  it('orders results by score, ties in stable catalog order', () => {
    const catalog = [MUSIC_STORY, KOMUZ_LESSON, KOMUZ];
    expect(searchCatalog(catalog, 'комуз').map((item) => item.id)).toEqual(['komuz', 'komuz-learn']);
    expect(searchCatalog([SONG, ISSYK], 'көл').map((item) => item.id)).toEqual(['song-kul', 'issyk-kul']);
    expect(searchCatalog([ISSYK, SONG], 'көл').map((item) => item.id)).toEqual(['issyk-kul', 'song-kul']);
  });

  it('excludes content without a real route and never duplicates an item', () => {
    const noRoute = makeItem({ id: 'soon', title: 'Ордо 2', searchText: ['Ордо 2'], route: null });
    expect(rankSearchResults([ORDO, noRoute, ORDO], 'ордо').map((result) => result.item.id)).toEqual(['ordo']);
  });

  it('zero results for a query nothing matches (never unrelated fallbacks)', () => {
    expect(rankSearchResults([ISSYK, SONG, ORDO, KOMUZ], 'xyzzy')).toEqual([]);
    expect(groupRankedResults([])).toEqual([]);
  });
});

describe('grouping', () => {
  it('maps every content type into Places / Culture / Collections / Trails / Games', () => {
    const expected: Record<CatalogContentType, string> = {
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
    for (const [type, group] of Object.entries(expected)) expect(groupForContentType(type as CatalogContentType)).toBe(group);
  });

  it('only non-empty groups, the group with the best match first', () => {
    const groups = groupRankedResults(rankSearchResults([ISSYK, KOMUZ_LESSON, ORDO, KOMUZ], 'ордо'));
    expect(groups.map((group) => group.id)).toEqual(['games']);
    const mixed = groupRankedResults(rankSearchResults([KOMUZ_LESSON, KOMUZ, ORDO], 'комуз'));
    expect(mixed.map((group) => group.id)).toEqual(['culture']);
    expect(mixed[0].items.map((item) => item.id)).toEqual(['komuz', 'komuz-learn']);
  });
});

describe('route mapping', () => {
  it('trails and collections route to their one real detail screen', () => {
    for (const item of buildTrailCatalog(trails, 'kg', () => null)) expect(item.route).toBe(`/trails/${item.id}`);
    for (const item of buildCollectionCatalog(collections, 'ru', null)) expect(item.route).toBe(`/collections/${item.id}`);
  });
});

describe('highlight', () => {
  it('marks the matched part of the displayed title, or nothing for alternate-name matches', () => {
    expect(highlightRange('Соң-Көл', 'көл')).toEqual([4, 7]);
    expect(highlightRange('Соң-Көл', 'сон')).toEqual([0, 3]);
    expect(highlightRange('Ысык-Көл', 'issyk')).toBeNull();
    expect(highlightRange('Ордо', '')).toBeNull();
  });
});

describe('privacy', () => {
  it('Journal is not a searchable content type, and search code never reads the Journal', () => {
    const types: CatalogContentType[] = ['game', 'region', 'nature', 'culture_category', 'culture_material', 'culture_item', 'interactive_experience', 'trail', 'collection'];
    expect(types.some((type) => type.includes('journal'))).toBe(false);
    const files = ['src/services/search/globalSearch.ts', 'src/services/search/recentSearches.ts', 'src/features/search/SearchScreen.tsx', 'src/features/search/SearchResultRow.tsx', 'src/services/content/contentCatalog.ts'];
    for (const file of files) {
      const source = fs.readFileSync(path.join(__dirname, '../../..', file), 'utf8');
      expect(source).not.toMatch(/useJournalStore|features\/journal|services\/journal/);
    }
  });
});
