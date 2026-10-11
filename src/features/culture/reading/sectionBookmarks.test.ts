/** Reading Companion: stable section anchors, missing sections/articles, ownership, write failures. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import { renderedSectionKeys } from '@/features/culture/itemSections';
import type { CultureItemRow } from '@/services/content/types';
import { ownerBookmarks, SECTION_BOOKMARKS_KEY, useSectionBookmarksStore } from '@/store/useSectionBookmarksStore';

import { SectionBookmark } from './SectionBookmark';
import { bookmarkKey, bookmarkRoute, bookmarkStatus, listBookmarks, normalizeBookmarks, removeBookmark, upsertBookmark } from './sectionBookmarks';

jest.mock('react-i18next', () => ({ initReactI18next: { type: '3rdParty', init: () => undefined }, useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('@/services/a11y/announce', () => ({ announce: () => undefined }));
jest.mock('@/features/games/records/useGameRecords', () => {
  const owner = jest.requireActual('zustand').create(() => ({ owner: 'user-a' }));
  return { mockOwner: owner, useRecordsOwner: () => owner((state: { owner: string }) => state.owner) };
});
const mockOwner = (jest.requireMock('@/features/games/records/useGameRecords') as { mockOwner: { setState: (state: { owner: string }) => void } }).mockOwner;
jest.mock('@/components/ui', () => {
  const { createElement: h } = jest.requireActual('react');
  return {
    AnimatedPressable: (props: Record<string, unknown>) => h('AnimatedPressable', props, props.children),
    Button: (props: Record<string, unknown>) => h('Button', props, props.label),
    TextField: (props: Record<string, unknown>) => h('TextField', props),
  };
});

const input = (sectionKey: string, note = '') => ({ contentType: 'culture_item' as const, contentId: 'boz-uy-tunduk', sectionKey, articleTitle: 'Tunduk', sectionLabel: sectionKey, note });

describe('stable anchors', () => {
  it('one bookmark per section key; the note updates in place', () => {
    let data = upsertBookmark({}, input('history', 'first'), new Date('2026-10-01'));
    data = upsertBookmark(data, input('history', 'edited'), new Date('2026-10-02'));
    data = upsertBookmark(data, input('cultural_meaning'), new Date('2026-10-03'));
    expect(Object.keys(data)).toEqual([bookmarkKey('culture_item', 'boz-uy-tunduk', 'history'), bookmarkKey('culture_item', 'boz-uy-tunduk', 'cultural_meaning')]);
    expect(data[bookmarkKey('culture_item', 'boz-uy-tunduk', 'history')]).toMatchObject({ note: 'edited', createdAt: new Date('2026-10-01').toISOString() });
    expect(listBookmarks(data).map(([, entry]) => entry.sectionKey)).toEqual(['cultural_meaning', 'history']);
    // Positions or made-up keys are not anchors.
    expect(upsertBookmark({}, input('3'))).toEqual({});
    expect(upsertBookmark({}, input('History Section'))).toEqual({});
  });

  it('reopening uses the section key as the anchor', () => {
    expect(bookmarkRoute({ contentType: 'culture_item', contentId: 'boz-uy-tunduk', sectionKey: 'objects_used' })).toBe('/culture/item/boz-uy-tunduk?section=objects_used');
  });

  it('an article update never moves a note to another section', () => {
    const data = upsertBookmark({}, input('history', 'about the history'));
    const bookmark = data[bookmarkKey('culture_item', 'boz-uy-tunduk', 'history')];
    const item = (fields: Partial<CultureItemRow>) => ({ id: 'boz-uy-tunduk', title: 'Tunduk', ...fields }) as CultureItemRow;
    expect(bookmarkStatus(bookmark, { exists: true, sections: renderedSectionKeys(item({ history: 'x', origin: 'y' })) })).toBe('ok');
    // The history section was removed (and sections reordered): the note stays on "history", marked missing.
    expect(bookmarkStatus(bookmark, { exists: true, sections: renderedSectionKeys(item({ origin: 'y', cultural_meaning: 'z' })) })).toBe('sectionMissing');
    expect(bookmarkStatus(bookmark, { exists: false, sections: null })).toBe('articleMissing');
    expect(bookmarkStatus(bookmark, null)).toBe('unknown'); // still loading: nothing is judged
    expect(bookmark.note).toBe('about the history');
  });

  it('tampered storage is bounded', () => {
    expect(normalizeBookmarks({ x: { contentType: 'region', contentId: 'a', sectionKey: 'history' }, y: { contentType: 'culture_item', contentId: '../x', sectionKey: 'history' } })).toEqual({});
    expect(removeBookmark({}, 'missing')).toEqual({});
  });
});

describe('the store', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useSectionBookmarksStore.setState({ status: 'ready', saved: {} });
  });

  it('per owner; survives a restart', async () => {
    expect(await useSectionBookmarksStore.getState().save('user-a', input('history', 'mine'))).toBe(true);
    expect(ownerBookmarks(useSectionBookmarksStore.getState().saved, 'user-b')).toEqual({});
    useSectionBookmarksStore.setState({ status: 'idle', saved: {} });
    await useSectionBookmarksStore.getState().load();
    expect(Object.values(ownerBookmarks(useSectionBookmarksStore.getState().saved, 'user-a'))[0].note).toBe('mine');
  });

  it('a failed write changes nothing; unreadable data is an error and is not saved over', async () => {
    const real = AsyncStorage.setItem;
    AsyncStorage.setItem = () => Promise.reject(new Error('disk full'));
    try {
      expect(await useSectionBookmarksStore.getState().save('user-a', input('history'))).toBe(false);
    } finally {
      AsyncStorage.setItem = real;
    }
    expect(ownerBookmarks(useSectionBookmarksStore.getState().saved, 'user-a')).toEqual({});
    await AsyncStorage.setItem(SECTION_BOOKMARKS_KEY, '{nope');
    useSectionBookmarksStore.setState({ status: 'idle', saved: {} });
    await useSectionBookmarksStore.getState().load();
    expect(useSectionBookmarksStore.getState().status).toBe('error');
    expect(await useSectionBookmarksStore.getState().save('user-a', input('history'))).toBe(false);
    expect(await AsyncStorage.getItem(SECTION_BOOKMARKS_KEY)).toBe('{nope');
  });
});

describe('the section control', () => {
  let screen: ReactTestRenderer;
  const all = (testID: string) => screen.root.findAll((node: ReactTestInstance) => node.props.testID === testID && typeof node.type === 'string');
  const has = (testID: string) => all(testID).length > 0;
  const press = (testID: string) => act(async () => { await all(testID)[0].props.onPress(); });
  beforeEach(async () => {
    await AsyncStorage.clear();
    mockOwner.setState({ owner: 'user-a' });
    useSectionBookmarksStore.setState({ status: 'ready', saved: {} });
    act(() => {
      screen = create(createElement(SectionBookmark, { contentType: 'culture_item', contentId: 'boz-uy-tunduk', sectionKey: 'history', sectionLabel: 'History', articleTitle: 'Tunduk' }));
    });
  });
  afterEach(() => act(() => screen.unmount()));

  it('save failure keeps the note; Retry saves what is in the field now; another account sees nothing', async () => {
    await press('section-bookmark-history');
    act(() => all('section-note-history')[0].props.onChangeText('First note'));
    const real = AsyncStorage.setItem;
    AsyncStorage.setItem = () => Promise.reject(new Error('disk full'));
    await press('section-save-history');
    AsyncStorage.setItem = real;
    expect(has('section-save-failed-history')).toBe(true);
    expect(all('section-note-history')[0].props.value).toBe('First note');
    act(() => all('section-note-history')[0].props.onChangeText('Better note'));
    await press('section-save-history');
    expect(Object.values(ownerBookmarks(useSectionBookmarksStore.getState().saved, 'user-a'))[0].note).toBe('Better note');
    expect(has('section-saved-history')).toBe(true);
    act(() => mockOwner.setState({ owner: 'user-b' }));
    expect(has('section-saved-history')).toBe(false);
  });
});
