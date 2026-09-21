import type { CatalogItem } from '@/services/content/contentCatalog';

import { groupForContentType, groupSearchResults, matchesQuery, normalizeSearchQuery, searchCatalog } from './globalSearch';

function makeItem(overrides: Partial<CatalogItem>): CatalogItem {
  return {
    contentType: 'game',
    id: 'x',
    title: 'X',
    metadata: null,
    thumbnail: null,
    route: '/x',
    searchText: ['X'],
    ...overrides,
  };
}

describe('normalizeSearchQuery', () => {
  it('trims and lowercases', () => {
    expect(normalizeSearchQuery('  Комуз  ')).toBe('комуз');
  });
});

describe('matchesQuery', () => {
  it('matches a substring in any of the item searchText entries, case-insensitively', () => {
    const item = makeItem({ searchText: ['Ысык-Көл', 'Иссык-Куль', 'Issyk-Kul'] });
    expect(matchesQuery(item, 'issyk')).toBe(true);
    expect(matchesQuery(item, 'ысык')).toBe(true);
    expect(matchesQuery(item, 'zzz')).toBe(false);
  });

  it('never matches an empty query', () => {
    expect(matchesQuery(makeItem({}), '')).toBe(false);
  });
});

describe('groupForContentType', () => {
  it('maps every content type into exactly one of the 4 display groups', () => {
    expect(groupForContentType('game')).toBe('games');
    expect(groupForContentType('culture_category')).toBe('culture');
    expect(groupForContentType('culture_item')).toBe('culture');
    expect(groupForContentType('interactive_experience')).toBe('culture');
    expect(groupForContentType('culture_material')).toBe('materials');
    expect(groupForContentType('region')).toBe('places');
    expect(groupForContentType('nature')).toBe('places');
  });
});

describe('searchCatalog', () => {
  const items = [
    makeItem({ id: 'ordo', contentType: 'game', title: 'Ordo', searchText: ['Ордо', 'Ordo'], route: '/games/ordo' }),
    makeItem({ id: 'komuz', contentType: 'culture_category', title: 'Комуз', searchText: ['Комуз'], route: '/culture/komuz' }),
    makeItem({ id: 'no-route', contentType: 'game', title: 'Coming soon', searchText: ['Coming soon'], route: null }),
  ];

  it('returns nothing for an empty query', () => {
    expect(searchCatalog(items, '   ')).toEqual([]);
  });

  it('matches across content types by substring', () => {
    expect(searchCatalog(items, 'ord').map((i) => i.id)).toEqual(['ordo']);
    expect(searchCatalog(items, 'комуз').map((i) => i.id)).toEqual(['komuz']);
  });

  it('excludes items with no real route to navigate to, even if the title matches', () => {
    expect(searchCatalog(items, 'coming')).toEqual([]);
  });
});

describe('groupSearchResults', () => {
  it('buckets results into all 4 groups, empty arrays for groups with no matches', () => {
    const items = [
      makeItem({ id: 'a', contentType: 'game' }),
      makeItem({ id: 'b', contentType: 'region' }),
      makeItem({ id: 'c', contentType: 'culture_material' }),
    ];
    const grouped = groupSearchResults(items);
    expect(grouped.games.map((i) => i.id)).toEqual(['a']);
    expect(grouped.places.map((i) => i.id)).toEqual(['b']);
    expect(grouped.materials.map((i) => i.id)).toEqual(['c']);
    expect(grouped.culture).toEqual([]);
  });
});
