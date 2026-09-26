import type { CatalogItem } from '@/services/content/contentCatalog';
import { useFavoritesStore } from '@/store/useFavoritesStore';

import { buildSavedView, CONTINUE_LIMIT, savedFilterOptions, savedSectionFor, visibleSections } from './savedModel';
import { toggleFavoriteWithFeedback } from './toggleFavoriteWithFeedback';

jest.mock('@/services/sync/outbox', () => ({ recordFavoriteOp: jest.fn(() => Promise.resolve()) }));
jest.mock('@/services/sync/syncTrigger', () => ({ requestAccountSync: jest.fn() }));
jest.mock('@/store/useAuthStore', () => ({ useAuthStore: { getState: () => ({ status: 'guest' }) } }));
jest.mock('@/components/ui/Toast', () => ({ showToast: jest.fn() }));
jest.mock('@/i18n', () => ({ __esModule: true, default: { t: (key: string) => key } }));

function item(contentType: CatalogItem['contentType'], id: string, overrides: Partial<CatalogItem> = {}): CatalogItem {
  return { contentType, id, title: id, metadata: null, thumbnail: null, route: `/${contentType}/${id}`, searchText: [id], ...overrides };
}

const CATALOG: CatalogItem[] = [
  item('nature', 'ala-kol'),
  item('region', 'naryn'),
  item('culture_item', 'komuz'),
  item('interactive_experience', 'boz-uy'),
  item('culture_material', 'epic'),
  item('game', 'ordo'),
  item('game', 'kok-boru'),
  item('trail', 'silk-road'),
  item('collection', 'crafts'),
];

const none = () => false;

describe('Saved view model', () => {
  it('groups saved content into Places / Culture / Games, only for sections that exist', () => {
    const view = buildSavedView({ favoriteIds: ['game:ordo', 'nature:ala-kol', 'culture_material:epic'], catalog: CATALOG, isOffline: none, recent: [] });
    expect(view.sections.map((section) => section.id)).toEqual(['places', 'culture', 'games']);
    expect(view.sections.map((section) => section.entries.map((entry) => entry.key))).toEqual([['nature:ala-kol'], ['culture_material:epic'], ['game:ordo']]);

    const onlyGames = buildSavedView({ favoriteIds: ['game:ordo'], catalog: CATALOG, isOffline: none, recent: [] });
    expect(onlyGames.sections.map((section) => section.id)).toEqual(['games']);
  });

  it('never exposes a section for non-favoritable types (trails, collections)', () => {
    expect(savedSectionFor('trail')).toBeNull();
    expect(savedSectionFor('collection')).toBeNull();
    expect(savedSectionFor('culture_category')).toBeNull();
    const view = buildSavedView({ favoriteIds: ['trail:silk-road', 'collection:crafts'], catalog: CATALOG, isOffline: none, recent: [] });
    expect(view.total).toBe(0);
  });

  it('empty favorites = empty view (the screen shows the empty state), never placeholder items', () => {
    const view = buildSavedView({ favoriteIds: [], catalog: CATALOG, isOffline: none, recent: [{ kind: 'place', id: 'ala-kol', at: '2026-09-20T10:00:00Z' }] });
    expect(view).toEqual({ total: 0, offlineCount: 0, sections: [], continueExploring: [] });
  });

  it('drops favorites whose content no longer exists or has no route', () => {
    const catalog = [...CATALOG, item('game', 'unbuilt', { route: null })];
    const view = buildSavedView({ favoriteIds: ['game:deleted', 'game:unbuilt', 'game:ordo'], catalog, isOffline: none, recent: [] });
    expect(view.total).toBe(1);
  });

  it('keeps deterministic catalog order (no saved timestamps exist on the device)', () => {
    const a = buildSavedView({ favoriteIds: ['game:kok-boru', 'game:ordo'], catalog: CATALOG, isOffline: none, recent: [] });
    const b = buildSavedView({ favoriteIds: ['game:ordo', 'game:kok-boru'], catalog: CATALOG, isOffline: none, recent: [] });
    expect(a.sections[0].entries.map((entry) => entry.key)).toEqual(['game:ordo', 'game:kok-boru']);
    expect(b.sections).toEqual(a.sections);
  });

  it('maps the offline badge only from a real download', () => {
    const downloaded = new Set(['ala-kol']);
    const view = buildSavedView({ favoriteIds: ['nature:ala-kol', 'culture_item:komuz'], catalog: CATALOG, isOffline: (entry) => downloaded.has(entry.id), recent: [] });
    const entries = view.sections.flatMap((section) => section.entries);
    expect(entries.find((entry) => entry.key === 'nature:ala-kol')?.offline).toBe(true);
    expect(entries.find((entry) => entry.key === 'culture_item:komuz')?.offline).toBe(false);
    expect(view.offlineCount).toBe(1);
  });

  it('Continue exploring = saved AND recently explored, newest first, capped - never auto-saving', () => {
    const recent = [
      { kind: 'place' as const, id: 'naryn', at: '2026-09-22T10:00:00Z' },
      { kind: 'place' as const, id: 'not-saved', at: '2026-09-21T10:00:00Z' },
      { kind: 'daily' as const, id: 'komuz', at: '2026-09-20T12:00:00' },
    ];
    const view = buildSavedView({ favoriteIds: ['culture_item:komuz', 'region:naryn', 'game:ordo'], catalog: CATALOG, isOffline: none, recent });
    expect(view.continueExploring.map((entry) => entry.key)).toEqual(['region:naryn', 'culture_item:komuz']);
    expect(view.total).toBe(3);

    const many = Array.from({ length: 8 }, (_, index) => item('nature', `n${index}`));
    const manyView = buildSavedView({
      favoriteIds: many.map((entry) => `nature:${entry.id}`),
      catalog: many,
      isOffline: none,
      recent: many.map((entry, index) => ({ kind: 'place' as const, id: entry.id, at: `2026-09-${10 + index}T00:00:00Z` })),
    });
    expect(manyView.continueExploring).toHaveLength(CONTINUE_LIMIT);
  });

  it('offers filters only for a long, mixed list, and only for sections that exist', () => {
    const small = buildSavedView({ favoriteIds: ['game:ordo', 'nature:ala-kol'], catalog: CATALOG, isOffline: none, recent: [] });
    expect(savedFilterOptions(small)).toEqual([]);
    const big = buildSavedView({ favoriteIds: ['game:ordo', 'game:kok-boru', 'nature:ala-kol', 'region:naryn', 'culture_item:komuz', 'interactive_experience:boz-uy'], catalog: CATALOG, isOffline: none, recent: [] });
    expect(savedFilterOptions(big)).toEqual(['all', 'places', 'culture', 'games']);
    expect(visibleSections(big, 'games').map((section) => section.id)).toEqual(['games']);
  });
});

describe('removing from Saved', () => {
  beforeEach(() => useFavoritesStore.setState({ favoriteIds: ['game:ordo', 'nature:ala-kol'], isLoaded: true }));

  it('un-saves immediately (local-first) and the item leaves the view', async () => {
    const pending = toggleFavoriteWithFeedback('nature', 'ala-kol');
    // Synchronous local update - the card disappears before any sync.
    expect(useFavoritesStore.getState().favoriteIds).toEqual(['game:ordo']);
    await pending;
    const view = buildSavedView({ favoriteIds: useFavoritesStore.getState().favoriteIds, catalog: CATALOG, isOffline: () => true, recent: [] });
    expect(view.sections.flatMap((section) => section.entries).map((entry) => entry.key)).toEqual(['game:ordo']);
  });

  it('shows the "Removed from Saved" toast', async () => {
    const { showToast } = jest.requireMock('@/components/ui/Toast') as { showToast: jest.Mock };
    showToast.mockClear();
    await toggleFavoriteWithFeedback('game', 'ordo');
    expect(showToast).toHaveBeenCalledWith('toast.removed', { haptic: false });
  });

  it('account switch: a reset favorites store leaves nothing of the previous account on Saved', () => {
    useFavoritesStore.getState().reset();
    const view = buildSavedView({ favoriteIds: useFavoritesStore.getState().favoriteIds, catalog: CATALOG, isOffline: () => true, recent: [{ kind: 'place', id: 'ala-kol', at: '2026-09-22T10:00:00Z' }] });
    expect(view.total).toBe(0);
    expect(view.continueExploring).toEqual([]);
  });
});
