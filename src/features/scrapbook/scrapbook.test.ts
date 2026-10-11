/** Cultural Scrapbook: live references, ordering vs sources, missing sources, owners, delayed and failed writes. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import { ownerScrapbook, ownerScrapbooks, useScrapbookStore } from '@/store/useScrapbookStore';

import { addEntry, MAX_ENTRIES, moveEntry, newScrapbook, normalizeScrapbook, resolveEntries, setCaption, type EntryRef, type Scrapbook } from './scrapbookModel';
import { ScrapbookScreen } from './ScrapbookScreens';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));
jest.mock('react-i18next', () => ({ initReactI18next: { type: '3rdParty', init: () => undefined }, useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/services/a11y/announce', () => ({ announce: () => undefined }));
jest.mock('@/store/useFeedbackStore', () => ({ useFeedbackStore: () => undefined }));
jest.mock('@/features/games/records/useGameRecords', () => {
  const owner = jest.requireActual('zustand').create(() => ({ owner: 'user-a' }));
  return { mockOwner: owner, useRecordsOwner: () => owner((state: { owner: string }) => state.owner) };
});
const mockOwner = (jest.requireMock('@/features/games/records/useGameRecords') as { mockOwner: { setState: (state: { owner: string }) => void } }).mockOwner;
jest.mock('@/store/useJournalStore', () => ({ useJournalStore: jest.requireActual('zustand').create(() => ({ isLoaded: true, entries: [{ id: 'j1', title: 'At the felt fair', date: '2026-10-01', note: 'Private journal words 4d', deletedAt: null }], load: async () => undefined })) }));
jest.mock('@/services/content/oymoCreationsService', () => ({ useOymoCreations: () => ({ isLoading: false, data: [{ id: 'd1', name: 'Felt corner', layers: [{}], background_color: '#fff', symmetry_mode: 'none' }] }) }));
jest.mock('@/features/culture/connections/useConnectionContent', () => ({
  useConnectionContent: () => ({ isLoading: false, get: (type: string, id: string) => (id === 'boz-uy-tunduk' ? { type, id, title: 'Tunduk', image: null } : null), all: () => [{ type: 'culture_item', id: 'boz-uy-tunduk', title: 'Tunduk', image: null }] }),
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

const article: EntryRef = { kind: 'article', contentType: 'culture_item', id: 'boz-uy-tunduk' };
const filled = () => setCaption(addEntry(addEntry(addEntry(newScrapbook('Synthetic book'), article, 'Tunduk'), { kind: 'journal', id: 'j1' }, 'At the felt fair'), { kind: 'design', id: 'd1' }, 'Felt corner'), 'article:culture_item:boz-uy-tunduk', 'Seen at a museum');

describe('the model', () => {
  it('live references: what shows comes from the source now; a vanished source keeps the snapshot and the caption', () => {
    const book = filled();
    const sources = { 'article:culture_item:boz-uy-tunduk': { title: 'Tunduk (renamed)', detail: null, route: '/culture/item/boz-uy-tunduk' } } as Record<string, { title: string; detail: null; route: string }>;
    const resolved = resolveEntries(book, (ref) => (ref.kind === 'article' ? sources['article:culture_item:boz-uy-tunduk'] : ref.kind === 'journal' ? null : undefined));
    expect(resolved.map((entry) => [entry.status, entry.source?.title ?? entry.titleSnapshot, entry.caption])).toEqual([
      ['ok', 'Tunduk (renamed)', 'Seen at a museum'],
      ['missing', 'At the felt fair', ''],
      ['loading', 'Felt corner', ''],
    ]);
  });

  it('rearranging changes only the scrapbook; at most 20 entries; no duplicates', () => {
    const sources = Object.freeze({ title: 'x' });
    const moved = moveEntry(filled(), 0, 1);
    expect(moved.entries.map((entry) => entry.ref.kind)).toEqual(['journal', 'article', 'design']);
    expect(Object.isFrozen(sources)).toBe(true);
    let book: Scrapbook = newScrapbook('x');
    for (let index = 0; index < 25; index += 1) book = addEntry(book, { kind: 'moment', id: `m${index}` }, '');
    expect(book.entries).toHaveLength(MAX_ENTRIES);
    expect(addEntry(filled(), article, 'again').entries).toHaveLength(3);
    expect(normalizeScrapbook({ id: 'sbabcde', entries: [{ ref: { kind: 'capsule', id: 'c1' } }, { ref: article, caption: 'kept' }] })?.entries.map((entry) => entry.ref.kind)).toEqual(['article']);
  });
});

describe('storage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useScrapbookStore.setState({ status: 'ready', saved: {} });
  });
  it('per owner; a failed write changes nothing', async () => {
    const book = filled();
    expect(await useScrapbookStore.getState().save('user-a', book)).toBe(true);
    expect(ownerScrapbooks(useScrapbookStore.getState().saved, 'user-b')).toEqual([]);
    const real = AsyncStorage.setItem;
    AsyncStorage.setItem = () => Promise.reject(new Error('disk full'));
    try {
      expect(await useScrapbookStore.getState().save('user-a', { ...book, title: 'Changed' })).toBe(false);
    } finally {
      AsyncStorage.setItem = real;
    }
    expect(ownerScrapbook(useScrapbookStore.getState().saved, 'user-a', book.id)?.title).toBe('Synthetic book');
  });
});

describe('the screen', () => {
  let screen: ReactTestRenderer;
  let book: Scrapbook;
  const all = (testID: string) => screen.root.findAll((node: ReactTestInstance) => node.props.testID === testID && typeof node.type === 'string');
  const has = (testID: string) => all(testID).length > 0;
  const press = (testID: string) => act(async () => { await all(testID)[0].props.onPress(); });
  beforeEach(async () => {
    await AsyncStorage.clear();
    mockOwner.setState({ owner: 'user-a' });
    book = filled();
    useScrapbookStore.setState({ status: 'ready', saved: { 'user-a': [book] } });
    act(() => {
      screen = create(createElement(ScrapbookScreen, { bookId: book.id, onPressBack: () => undefined }));
    });
  });
  afterEach(() => act(() => screen.unmount()));

  it('an edit made while a save is still being written survives that save', async () => {
    act(() => all('scrapbook-caption-1')[0].props.onChangeText('First edit'));
    const real = AsyncStorage.setItem;
    let release: () => void = () => undefined;
    AsyncStorage.setItem = (key: string, value: string) => new Promise<void>((resolve) => (release = () => void real(key, value).then(resolve)));
    let saving: Promise<void> = Promise.resolve();
    act(() => {
      saving = all('scrapbook-save')[0].props.onPress();
    });
    // While the write is pending, another edit.
    act(() => all('scrapbook-caption-2')[0].props.onChangeText('Second edit'));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      release();
      await saving;
    });
    AsyncStorage.setItem = real;
    expect(ownerScrapbook(useScrapbookStore.getState().saved, 'user-a', book.id)?.entries[1].caption).toBe('First edit');
    // The newer edit is still on screen and still unsaved.
    expect(all('scrapbook-caption-2')[0].props.value).toBe('Second edit');
    expect(has('scrapbook-unsaved')).toBe(true);
    await press('scrapbook-save');
    expect(ownerScrapbook(useScrapbookStore.getState().saved, 'user-a', book.id)?.entries.map((entry) => entry.caption)).toEqual(['Seen at a museum', 'First edit', 'Second edit']);
  });

  it('a failed save keeps the edit for Retry; another account sees nothing', async () => {
    act(() => all('scrapbook-caption-0')[0].props.onChangeText('Edited'));
    const real = AsyncStorage.setItem;
    AsyncStorage.setItem = () => Promise.reject(new Error('disk full'));
    await press('scrapbook-save');
    AsyncStorage.setItem = real;
    expect(has('scrapbook-save-failed')).toBe(true);
    expect(all('scrapbook-caption-0')[0].props.value).toBe('Edited');
    act(() => mockOwner.setState({ owner: 'user-b' }));
    expect(has('scrapbook-screen')).toBe(false);
    expect(JSON.stringify(screen.toJSON())).not.toContain('Seen at a museum');
  });
});
