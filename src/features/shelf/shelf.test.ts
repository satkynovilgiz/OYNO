/** My OYNO Shelf: adapters, filtering/search/sort, sealed capsules, ownership, partial failures. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import { editDraft, newCapsule, seal } from '@/features/capsules/capsuleModel';
import { createBoard } from '@/features/culture/board/boardModel';
import { useCapsuleStore } from '@/store/useCapsuleStore';
import { useDiscoveryBoardStore } from '@/store/useDiscoveryBoardStore';
import { useMyCollectionsStore } from '@/store/useMyCollectionsStore';

import { boardItems, capsuleItems, designItems, exhibitionItems, shelfView, type ShelfItem } from './shelfModel';
import { ShelfScreen } from './ShelfScreen';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));
jest.mock('react-i18next', () => ({ initReactI18next: { type: '3rdParty', init: () => undefined }, useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }) }));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/features/games/records/useGameRecords', () => {
  const owner = jest.requireActual('zustand').create(() => ({ owner: 'user-a' }));
  return { mockOwner: owner, useRecordsOwner: () => owner((state: { owner: string }) => state.owner) };
});
const mockOwner = (jest.requireMock('@/features/games/records/useGameRecords') as { mockOwner: { setState: (state: { owner: string }) => void } }).mockOwner;
// Saved designs come from the account (react-query); per owner here.
const mockDesigns: Record<string, unknown> = { 'user-a': { data: [{ id: 'd1', name: 'Felt corner', layers: [{}, {}], background_color: '#fff', symmetry_mode: 'none', created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-05T10:00:00Z' }] } };
jest.mock('@tanstack/react-query', () => ({ useQuery: ({ queryKey, enabled }: { queryKey: string[]; enabled: boolean }) => (enabled ? ((mockDesigns[queryKey[2]] as object) ?? { data: [] }) : { data: undefined }) }));
jest.mock('@/components/ui', () => {
  const { createElement: h } = jest.requireActual('react');
  return {
    AnimatedPressable: (props: Record<string, unknown>) => h('AnimatedPressable', props, props.children),
    Button: (props: Record<string, unknown>) => h('Button', props, props.label),
    IconButton: (props: Record<string, unknown>) => h('IconButton', props),
    TextField: (props: Record<string, unknown>) => h('TextField', props),
  };
});

const SECRET = 'The secret message 9q';
const sealedCapsule = () => seal(editDraft(newCapsule(new Date('2026-10-02T10:00:00Z')), { title: 'For next year', message: SECRET, openOn: '2027-10-02' }), '2026-10-02', new Date('2026-10-02T11:00:00Z'));
const item = (patch: Partial<ShelfItem>): ShelfItem => ({ key: patch.key ?? 'k', type: 'board', id: 'x', title: null, createdAt: null, updatedAt: null, route: '/', storage: 'device', detail: null, ...patch });

describe('adapters', () => {
  it('each type opens its existing route, with truthful storage labels', () => {
    expect(designItems((mockDesigns['user-a'] as { data: Parameters<typeof designItems>[0] }).data)[0]).toMatchObject({ type: 'design', title: 'Felt corner', route: '/culture/oymo/create?creation=d1', storage: 'cloud', detail: { params: { count: 2 } } });
    const board = createBoard({ type: 'culture_item', id: 'boz-uy-tunduk', titleSnapshot: 'T' }, { question: 'q', promptId: null, title: '' });
    expect(boardItems([board])[0]).toMatchObject({ type: 'board', title: null, route: `/culture/board/${board.id}`, storage: 'device' });
    const collections = { collections: [{ id: 'uc_1', name: 'Yurt things', description: null, createdAt: '2026-09-01T10:00:00Z', updatedAt: '2026-09-02T10:00:00Z' }], items: [] };
    expect(exhibitionItems({ uc_1: { title: '', intro: '', exhibits: ['a'], captions: {}, updatedAt: '2026-10-03T10:00:00Z' }, uc_gone: { title: 'x', intro: '', exhibits: [], captions: {}, updatedAt: '' } }, collections)).toEqual([
      expect.objectContaining({ type: 'exhibition', id: 'uc_1', title: 'Yurt things', route: '/profile/my-collections/museum?collection=uc_1', createdAt: '2026-09-01T10:00:00Z', updatedAt: '2026-10-03T10:00:00Z' }),
    ]);
  });

  it('a sealed capsule exposes only its title, state and date - never the message', () => {
    const [entry] = capsuleItems([sealedCapsule()]);
    expect(JSON.stringify(entry)).not.toContain(SECRET);
    expect(entry).toMatchObject({ title: 'For next year', detail: { key: 'shelf.detail.sealedUntil', params: { date: '2027-10-02' } } });
    // Searching for words of the message finds nothing.
    expect(shelfView([entry], { type: 'all', query: 'secret', sort: 'updated' })).toEqual([]);
  });
});

describe('filter, search, sort', () => {
  const items = [
    item({ key: 'a', type: 'design', title: 'Ötkön', updatedAt: '2026-10-05T00:00:00Z', createdAt: '2026-01-01T00:00:00Z' }),
    item({ key: 'b', type: 'board', title: 'Alpha', updatedAt: null, createdAt: '2026-05-01T00:00:00Z' }),
    item({ key: 'c', type: 'capsule', title: null, updatedAt: '2026-10-06T00:00:00Z', createdAt: null }),
    item({ key: 'd', type: 'board', title: 'beta', updatedAt: '2026-10-01T00:00:00Z', createdAt: '2026-05-01T00:00:00Z' }),
  ];
  it('missing dates sort last; ties are stable', () => {
    expect(shelfView(items, { type: 'all', query: '', sort: 'updated' }).map((entry) => entry.key)).toEqual(['c', 'a', 'd', 'b']);
    expect(shelfView(items, { type: 'all', query: '', sort: 'created' }).map((entry) => entry.key)).toEqual(['b', 'd', 'a', 'c']);
    expect(shelfView(items, { type: 'all', query: '', sort: 'title' }).map((entry) => entry.key)).toEqual(['b', 'd', 'a', 'c']);
  });
  it('search is on titles, case and diacritics insensitive; untitled only for the empty query; type filter', () => {
    expect(shelfView(items, { type: 'all', query: 'OTK', sort: 'updated' }).map((entry) => entry.key)).toEqual(['a']);
    expect(shelfView(items, { type: 'all', query: 'untitled', sort: 'updated' })).toEqual([]);
    expect(shelfView(items, { type: 'board', query: '', sort: 'title' }).map((entry) => entry.key)).toEqual(['b', 'd']);
  });
});

describe('the screen', () => {
  let screen: ReactTestRenderer;
  const has = (testID: string) => screen.root.findAll((node: ReactTestInstance) => node.props.testID === testID && typeof node.type === 'string').length > 0;
  const items = () => screen.root.findAll((node: ReactTestInstance) => typeof node.props.testID === 'string' && node.props.testID.startsWith('shelf-item-') && typeof node.type === 'string').map((node) => node.props.testID as string);
  beforeEach(async () => {
    await AsyncStorage.clear();
    mockOwner.setState({ owner: 'user-a' });
    useMyCollectionsStore.setState({ isLoaded: true, saved: {}, museums: {} });
    useDiscoveryBoardStore.setState({ isLoaded: true, status: 'ready', saved: { 'user-a': [createBoard({ type: 'culture_item', id: 'boz-uy-tunduk', titleSnapshot: 'T' }, { question: 'q', promptId: null, title: 'Board A' })] } });
    useCapsuleStore.setState({ status: 'ready', saved: { 'user-a': [sealedCapsule()] } });
  });
  afterEach(() => act(() => screen.unmount()));
  const render = () =>
    act(() => {
      screen = create(createElement(ShelfScreen, { onPressBack: () => undefined }));
    });

  it('a failed source is shown as failed (with Retry) while the others stay visible', async () => {
    // The boards can't be read (a persistent storage failure).
    const realGet = AsyncStorage.getItem;
    AsyncStorage.getItem = (key: string) => (key === 'oyno.discoveryBoards.v1' ? Promise.reject(new Error('read failed')) : realGet(key));
    useDiscoveryBoardStore.setState({ isLoaded: false, status: 'idle', saved: {} });
    render();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    AsyncStorage.getItem = realGet;
    expect(has('shelf-error-board')).toBe(true);
    expect(has('shelf-empty-board')).toBe(false);
    expect(items().some((id) => id.startsWith('shelf-item-design:'))).toBe(true);
    expect(items().some((id) => id.startsWith('shelf-item-capsule:'))).toBe(true);
    expect(JSON.stringify(screen.toJSON())).not.toContain(SECRET);
  });

  it('switching account immediately removes the previous owner’s items; a guest sees designs as unavailable, not empty', () => {
    render();
    expect(items().length).toBe(3);
    act(() => mockOwner.setState({ owner: 'guest' }));
    expect(items()).toEqual([]);
    expect(has('shelf-unavailable-design')).toBe(true);
    expect(has('shelf-empty-design')).toBe(false);
    expect(has('shelf-empty-board')).toBe(true);
  });
});
