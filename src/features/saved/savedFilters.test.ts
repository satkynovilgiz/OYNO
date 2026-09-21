import type { CatalogItem } from '@/services/content/contentCatalog';

import { filterForContentType, filterSavedItems, resolveSavedItems } from './savedFilters';

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

describe('filterForContentType', () => {
  it('maps each favoritable content type into exactly one of the 3 filter buckets', () => {
    expect(filterForContentType('game')).toBe('games');
    expect(filterForContentType('culture_material')).toBe('culture');
    expect(filterForContentType('culture_item')).toBe('culture');
    expect(filterForContentType('interactive_experience')).toBe('culture');
    expect(filterForContentType('region')).toBe('places');
    expect(filterForContentType('nature')).toBe('places');
  });

  it('has no bucket for culture_category (not a favoritable content type)', () => {
    expect(filterForContentType('culture_category')).toBeNull();
  });
});

describe('filterSavedItems', () => {
  const items = [
    makeItem({ id: 'ordo', contentType: 'game' }),
    makeItem({ id: 'ysyk-kol', contentType: 'nature' }),
    makeItem({ id: 'komuz-item', contentType: 'culture_item' }),
    makeItem({ id: 'komuz-material', contentType: 'culture_material' }),
  ];

  it('returns everything for "all"', () => {
    expect(filterSavedItems(items, 'all')).toHaveLength(4);
  });

  it('filters to just games', () => {
    expect(filterSavedItems(items, 'games').map((i) => i.id)).toEqual(['ordo']);
  });

  it('folds culture_item and culture_material into the same "culture" bucket', () => {
    expect(filterSavedItems(items, 'culture').map((i) => i.id).sort()).toEqual(['komuz-item', 'komuz-material']);
  });

  it('filters to places', () => {
    expect(filterSavedItems(items, 'places').map((i) => i.id)).toEqual(['ysyk-kol']);
  });
});

describe('resolveSavedItems', () => {
  const catalog = [
    makeItem({ id: 'a', contentType: 'game' }),
    makeItem({ id: 'b', contentType: 'nature' }),
    makeItem({ id: 'c', contentType: 'culture_item' }),
  ];

  it('resolves favorite keys to catalog items in most-recently-saved-first order', () => {
    const result = resolveSavedItems(['game:a', 'nature:b'], catalog);
    expect(result.map((i) => i.id)).toEqual(['b', 'a']);
  });

  it('silently drops a favorited key that no longer resolves to any catalog item', () => {
    const result = resolveSavedItems(['game:a', 'game:deleted-game'], catalog);
    expect(result.map((i) => i.id)).toEqual(['a']);
  });
});
