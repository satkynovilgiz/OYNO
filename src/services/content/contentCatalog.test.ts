import type { GameListItem } from '@/features/games/types';

import {
  buildCultureCategoryCatalog,
  buildCultureItemCatalog,
  buildCultureMaterialCatalog,
  buildExploreCatalog,
  buildGameCatalog,
  buildInteractiveExperienceCatalog,
} from './contentCatalog';
import type { CultureCategoryRow, CultureItemRow, CultureMaterialRow, ExploreRegionRow } from './types';

const t = (key: string, options?: { lng?: string }) => (options?.lng ? `${key}[${options.lng}]` : key);

function makeGame(overrides: Partial<GameListItem> = {}): GameListItem {
  return {
    id: 'ordo',
    category: 'national',
    difficulty: 'medium',
    players: { kind: 'exact', count: 2 },
    duration: { minMinutes: 5, maxMinutes: 25 },
    route: '/games/ordo',
    ...overrides,
  };
}

describe('buildGameCatalog', () => {
  it('maps id/route through and resolves title via the i18n key convention', () => {
    const [item] = buildGameCatalog([makeGame()], t);
    expect(item.contentType).toBe('game');
    expect(item.id).toBe('ordo');
    expect(item.title).toBe('games.titles.ordo');
    expect(item.route).toBe('/games/ordo');
    expect(item.metadata).toBe('games.categories.national');
    expect(item.searchText).toEqual(['games.titles.ordo[kg]', 'games.titles.ordo[ru]', 'games.titles.ordo[en]']);
  });

  it('leaves route null for a game with no built screen yet', () => {
    const [item] = buildGameCatalog([makeGame({ id: 'toguz-korgool', route: undefined })], t);
    expect(item.route).toBeNull();
  });
});

describe('buildCultureCategoryCatalog', () => {
  it('special-cases the games category to route to /games', () => {
    const row: CultureCategoryRow = { id: 'games', title: 'Games', sort_order: 0 };
    const [item] = buildCultureCategoryCatalog([row]);
    expect(item.route).toBe('/games');
  });

  it('routes every other category to /culture/:id and keeps its raw title', () => {
    const row: CultureCategoryRow = { id: 'komuz', title: 'Комуз', sort_order: 1 };
    const [item] = buildCultureCategoryCatalog([row]);
    expect(item.route).toBe('/culture/komuz');
    expect(item.title).toBe('Комуз');
  });
});

describe('buildCultureItemCatalog', () => {
  it('resolves metadata to the parent category title by category_id', () => {
    const item: CultureItemRow = {
      id: 'boz-uy-tunduk',
      category_id: 'boz-uy',
      subgroup: null,
      title: 'Түндүк',
      alt_names: null,
      type_label: null,
      origin: null,
      history: null,
      cultural_meaning: null,
      when_used: null,
      ingredients: null,
      traditional_method: null,
      who_participates: null,
      objects_used: null,
      regional_notes: null,
      modern_status: null,
      fun_facts: null,
      simple_summary_kg: null,
      simple_summary_ru: null,
      simple_summary_en: null,
      accuracy_level: 'verified',
      sources: null,
      sort_order: 0,
      image_url: null,
    };
    const category: CultureCategoryRow = { id: 'boz-uy', title: 'Боз үй', sort_order: 0 };
    const [result] = buildCultureItemCatalog([item], [category]);
    expect(result.metadata).toBe('Боз үй');
    expect(result.route).toBe('/culture/item/boz-uy-tunduk');
  });
});

describe('buildCultureMaterialCatalog', () => {
  it('formats duration_minutes into metadata when present, otherwise null', () => {
    const withDuration: CultureMaterialRow = {
      id: 'komuz-discovery',
      kind: 'today_discovery',
      title: 'Komuz',
      description: null,
      duration_minutes: 3,
      sort_order: 0,
      body: null,
      accuracy_level: 'verified',
      sources: null,
      image_url: null,
    };
    const withoutDuration: CultureMaterialRow = { ...withDuration, id: 'other', duration_minutes: null };
    const [a, b] = buildCultureMaterialCatalog([withDuration, withoutDuration]);
    expect(a.metadata).toBe('3 min');
    expect(b.metadata).toBeNull();
    expect(a.route).toBe('/culture/material/komuz-discovery');
  });
});

describe('buildExploreCatalog', () => {
  const region: ExploreRegionRow = {
    id: 'ysyk-kol',
    kind: 'nature',
    name_kg: 'Ысык-Көл',
    name_ru: 'Иссык-Куль',
    name_en: 'Issyk-Kul',
    tagline: 'The warm lake',
    facts: [],
    status: 'verified',
    sort_order: 0,
  };

  it('resolves the title in the requested language, falling back to kg', () => {
    expect(buildExploreCatalog([region], 'en')[0].title).toBe('Issyk-Kul');
    expect(buildExploreCatalog([region], 'kg')[0].title).toBe('Ысык-Көл');
  });

  it('carries the region/nature kind through as contentType', () => {
    expect(buildExploreCatalog([region], 'en')[0].contentType).toBe('nature');
  });

  it('exposes all 3 locale variants in searchText regardless of the resolved title language', () => {
    expect(buildExploreCatalog([region], 'en')[0].searchText).toEqual(['Ысык-Көл', 'Иссык-Куль', 'Issyk-Kul']);
  });
});

describe('buildInteractiveExperienceCatalog', () => {
  it('resolves a route for every one of the 4 known experiences', () => {
    const items = buildInteractiveExperienceCatalog(t);
    expect(items).toHaveLength(4);
    expect(items.every((item) => typeof item.route === 'string')).toBe(true);
  });
});
