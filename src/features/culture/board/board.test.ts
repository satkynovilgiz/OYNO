/** Culture Discovery Board: sourced vs personal links, persistence per owner, missing content, returning from a source. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import { CULTURE_CONNECTIONS } from '@/features/culture/connections/connectionsData';
import { connectionById } from '@/features/culture/connections/connectionsModel';
import { DISCOVERY_BOARDS_KEY, ownerBoard, ownerBoards, useDiscoveryBoardStore } from '@/store/useDiscoveryBoardStore';

import { addCard, addObservation, attachConnection, availableConnections, connectedSuggestions, createBoard, MAX_CARDS, moveCard, normalizeBoard, removeCard, removeLink, rename, reviewBoard, type Board } from './boardModel';
import { BoardScreen } from './DiscoveryBoardScreens';

jest.mock('react-i18next', () => ({ initReactI18next: { type: '3rdParty', init: () => undefined }, useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (path: string) => mockPush(path), replace: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/services/a11y/announce', () => ({ announce: () => undefined }));
jest.mock('@/features/games/records/useGameRecords', () => {
  const owner = jest.requireActual('zustand').create(() => ({ owner: 'user-a' }));
  return { mockOwner: owner, useRecordsOwner: () => owner((state: { owner: string }) => state.owner) };
});
const mockOwner = (jest.requireMock('@/features/games/records/useGameRecords') as { mockOwner: { setState: (state: { owner: string }) => void } }).mockOwner;
// Article titles as the app resolves them; `mockGone` simulates content that is no longer available.
const mockTitles: Record<string, string> = { 'culture_item:boz-uy-tunduk': 'Tunduk', 'culture_item:boz-uy-karkas': 'Karkas', 'culture_item:boz-uy-overview': 'Boz uy', 'culture_item:boz-uy-kiyiz-jabuu': 'Kiyiz jabuu' };
const mockGone = new Set<string>();
jest.mock('@/features/culture/connections/useConnectionContent', () => ({
  useConnectionContent: () => {
    const get = (type: string, id: string) => (mockGone.has(`${type}:${id}`) || !mockTitles[`${type}:${id}`] ? null : { type, id, title: mockTitles[`${type}:${id}`], image: null });
    return { get, all: () => Object.keys(mockTitles).filter((key) => !mockGone.has(key)).map((key) => get(key.split(':')[0], key.split(':')[1])), exists: (type: string, id: string) => !!get(type, id), isLoading: false, waitingForNetwork: false, retry: () => undefined };
  },
}));
jest.mock('@/components/ui', () => {
  const { createElement: h } = jest.requireActual('react');
  return {
    AnimatedPressable: (props: Record<string, unknown>) => h('AnimatedPressable', props, props.children),
    Button: (props: Record<string, unknown>) => h('Button', props, props.label),
    IconButton: (props: Record<string, unknown>) => h('IconButton', props),
    TextField: (props: Record<string, unknown>) => h('TextField', props),
    TextButton: (props: Record<string, unknown>) => h('TextButton', props),
  };
});
jest.mock('@/store/useFeedbackStore', () => ({ useFeedbackStore: () => undefined }));

const tunduk = { type: 'culture_item' as const, id: 'boz-uy-tunduk', titleSnapshot: 'Tunduk' };
const karkas = { type: 'culture_item' as const, id: 'boz-uy-karkas', titleSnapshot: 'Karkas' };
const overview = { type: 'culture_item' as const, id: 'boz-uy-overview', titleSnapshot: 'Boz uy' };
const base = () => createBoard(tunduk, { question: 'What connects these objects?', promptId: 'connects', title: 'Yurt parts' });
const titles = (type: string, id: string) => (mockGone.has(`${type}:${id}`) ? null : (mockTitles[`${type}:${id}`] ?? null));

describe('sourced connections come only from the dataset', () => {
  it('only entries between two cards on the board can be attached, each resolving to the dataset', () => {
    let board = base();
    expect(availableConnections(board)).toEqual([]);
    expect(attachConnection(board, 'tunduk-part-of-karkas')).toBe(board); // karkas not on the board yet
    board = addCard(board, karkas);
    expect(availableConnections(board).map((connection) => connection.id)).toEqual(['tunduk-part-of-karkas']);
    board = attachConnection(board, 'tunduk-part-of-karkas');
    expect(attachConnection(board, 'tunduk-part-of-karkas')).toBe(board); // not twice
    expect(attachConnection(board, 'made-up-connection')).toBe(board);
    for (const link of board.links) if (link.kind === 'sourced') expect(connectionById(link.connectionId)).not.toBeNull();
    const [link] = reviewBoard(board, titles).links;
    expect(link).toMatchObject({ kind: 'sourced', fromTitle: 'Tunduk', toTitle: 'Karkas', sourceTitle: 'Karkas', field: 'objects_used', sourceAvailable: true });
    expect(link.kind === 'sourced' && link.connection.evidence).toBe(CULTURE_CONNECTIONS.find((entry) => entry.id === 'tunduk-part-of-karkas')!.evidence);
  });

  it('an observation never becomes a connection, even if it states one', () => {
    let board = addCard(base(), overview);
    board = addObservation(board, 'Tunduk is part of the boz uy', ['culture_item:boz-uy-tunduk', 'culture_item:boz-uy-overview']);
    const review = reviewBoard(board, titles);
    expect(review.links).toEqual([{ id: board.links[0].id, kind: 'observation', text: 'Tunduk is part of the boz uy', about: ['Tunduk', 'Boz uy'] }]);
    expect(availableConnections(board)).toEqual([]); // no sourced entry exists between these two: nothing inferred
    expect(addObservation(board, '   ', [])).toBe(board);
  });

  it('a stored reference that left the dataset is kept but never shown as a connection', () => {
    const board = normalizeBoard({ ...base(), links: [{ id: 'l1', kind: 'sourced', connectionId: 'removed-entry' }] }) as Board;
    expect(reviewBoard(board, titles).links).toEqual([{ id: 'l1', kind: 'missingConnection', connectionId: 'removed-entry' }]);
  });
});

describe('editing', () => {
  it('up to eight cards, no duplicates; reorder; rename', () => {
    let board = base();
    for (let index = 0; index < 10; index += 1) board = addCard(board, { type: 'culture_item', id: `item-${index}`, titleSnapshot: `Item ${index}` });
    expect(board.cards).toHaveLength(MAX_CARDS);
    expect(addCard(board, tunduk)).toBe(board);
    board = moveCard(board, 0, 1);
    expect(board.cards[1].id).toBe('boz-uy-tunduk');
    expect(moveCard(board, 0, -1)).toBe(board);
    expect(rename(board, 'A <b>new</b> name').title).toBe('A bnew/b name');
  });

  it('removing a card drops connections that need it but keeps observations', () => {
    let board = attachConnection(addCard(base(), karkas), 'tunduk-part-of-karkas');
    board = addObservation(board, 'Seen at a museum', ['culture_item:boz-uy-karkas']);
    board = removeCard(board, 'culture_item:boz-uy-karkas');
    expect(board.links).toEqual([{ id: expect.any(String), kind: 'observation', text: 'Seen at a museum', cards: [] }]);
    board = removeLink(board, board.links[0].id);
    expect(board.links).toEqual([]);
  });

  it('suggests articles the dataset links to cards on the board', () => {
    expect(connectedSuggestions(base()).map((ref) => ref.id)).toContain('boz-uy-karkas');
  });
});

describe('missing content', () => {
  afterEach(() => mockGone.clear());
  it('an unavailable article keeps its card (remembered title) and its notes, marked unavailable', () => {
    let board = attachConnection(addCard(base(), karkas), 'tunduk-part-of-karkas');
    board = addObservation(board, 'Note about karkas', ['culture_item:boz-uy-karkas']);
    mockGone.add('culture_item:boz-uy-karkas');
    const review = reviewBoard(board, titles);
    expect(review.cards[1]).toMatchObject({ title: 'Karkas', available: false });
    expect(review.links.map((link) => link.kind)).toEqual(['sourced', 'observation']);
    expect(review.links[0]).toMatchObject({ sourceAvailable: false });
    expect(review.links[1]).toMatchObject({ about: ['Karkas'] });
  });

  it('tampered storage is bounded, not fatal', () => {
    expect(normalizeBoard(null)).toBeNull();
    expect(normalizeBoard({ id: '../x' })).toBeNull();
    const board = normalizeBoard({ id: 'b1', cards: [{ type: 'region', id: 'x' }, tunduk, tunduk], links: [{ id: 'l', kind: 'magic' }], promptId: 'invented' });
    expect(board).toMatchObject({ cards: [tunduk], links: [], promptId: null });
  });
});

describe('storage per owner', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useDiscoveryBoardStore.setState({ isLoaded: true, saved: {} });
  });

  it('saved locally, survives a restart, never visible to another account', async () => {
    const board = base();
    expect(useDiscoveryBoardStore.getState().add('user-a', board)).toBe(true);
    useDiscoveryBoardStore.getState().update('user-a', board.id, (current) => rename(current, 'Renamed'));
    useDiscoveryBoardStore.getState().update('user-b', board.id, (current) => rename(current, 'Hijacked'));
    useDiscoveryBoardStore.getState().remove('user-b', board.id);
    expect(ownerBoards(useDiscoveryBoardStore.getState().saved, 'user-b')).toEqual([]);
    expect(ownerBoard(useDiscoveryBoardStore.getState().saved, 'user-b', board.id)).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(JSON.parse((await AsyncStorage.getItem(DISCOVERY_BOARDS_KEY)) ?? '{}')['user-a'][0].title).toBe('Renamed');
    useDiscoveryBoardStore.setState({ isLoaded: false, saved: {} });
    await useDiscoveryBoardStore.getState().load();
    expect(ownerBoard(useDiscoveryBoardStore.getState().saved, 'user-a', board.id)?.title).toBe('Renamed');
    useDiscoveryBoardStore.getState().remove('user-a', board.id);
    expect(ownerBoards(useDiscoveryBoardStore.getState().saved, 'user-a')).toEqual([]);
  });
});

describe('the board screen', () => {
  let screen: ReactTestRenderer;
  let board: Board;
  const all = (testID: string) => screen.root.findAll((node: ReactTestInstance) => node.props.testID === testID && typeof node.type === 'string');
  const has = (testID: string) => all(testID).length > 0;
  const press = (testID: string) => act(() => (all(testID)[0].props.onPress as () => void)());
  const render = () =>
    act(() => {
      screen = create(createElement(BoardScreen, { boardId: board.id, onPressBack: () => undefined }));
    });

  beforeEach(async () => {
    await AsyncStorage.clear();
    mockOwner.setState({ owner: 'user-a' });
    mockPush.mockClear();
    board = attachConnection(addCard(base(), karkas), 'tunduk-part-of-karkas');
    useDiscoveryBoardStore.setState({ isLoaded: true, saved: { 'user-a': [board] } });
    render();
  });
  afterEach(() => act(() => screen.unmount()));

  it('opening a source and coming back keeps the board, an unsent observation and the mode', () => {
    act(() => (all('board-note')[0].props.onChangeText as (value: string) => void)('Half-written note'));
    press('board-note-card-1');
    press('board-open-source-tunduk-part-of-karkas');
    expect(mockPush).toHaveBeenCalledWith('/culture/item/boz-uy-karkas');
    // The screen is re-created on return (e.g. web history): the draft is still there.
    act(() => screen.unmount());
    render();
    expect(all('board-note')[0].props.value).toBe('Half-written note');
    expect(all('board-note-card-1')[0].props.accessibilityState).toMatchObject({ checked: true });
    press('board-mode-review');
    act(() => screen.unmount());
    render();
    expect(has('board-review')).toBe(true);
    expect(has('board-sourced-tunduk-part-of-karkas')).toBe(true);
  });

  it('personal observations are labelled; another account sees no board', () => {
    act(() => (all('board-note')[0].props.onChangeText as (value: string) => void)('My note'));
    press('board-note-save');
    const saved = ownerBoard(useDiscoveryBoardStore.getState().saved, 'user-a', board.id)!;
    const note = saved.links.find((link) => link.kind === 'observation')!;
    expect(has(`board-observation-${note.id}`)).toBe(true);
    act(() => mockOwner.setState({ owner: 'user-b' }));
    expect(has('board-edit')).toBe(false);
    expect(has(`board-observation-${note.id}`)).toBe(false);
  });

  it('a missing article is marked, not erased, and the board still renders', () => {
    mockGone.add('culture_item:boz-uy-karkas');
    act(() => screen.unmount());
    render();
    expect(has('board-card-unavailable-1')).toBe(true);
    expect(ownerBoard(useDiscoveryBoardStore.getState().saved, 'user-a', board.id)?.cards).toHaveLength(2);
    mockGone.clear();
  });
});
