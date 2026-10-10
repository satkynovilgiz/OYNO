/** Curator Challenge: draft lifecycle, concrete requirements, dataset-only connections, ownership, explicit save with retry. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import { connectionById } from '@/features/culture/connections/connectionsModel';
import { ownerDraft, useChallengeDraftStore } from '@/store/useChallengeDraftStore';
import { ownerCollections, ownerExhibition, useMyCollectionsStore } from '@/store/useMyCollectionsStore';

import { complete, connectionsBetween, MAX_PICKS, movePick, normalizeDraft, requirements, setCaption, setIntro, setName, setPrompt, startDraft, suggestedPicks, toExhibition, togglePick, type ChallengeDraft } from './challengeModel';
import { CuratorChallengeScreen } from './CuratorChallengeScreen';
import { normalizeExhibition } from './museumModel';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));
jest.mock('react-i18next', () => ({ initReactI18next: { type: '3rdParty', init: () => undefined }, useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: (target: unknown) => mockReplace(target) } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/services/a11y/announce', () => ({ announce: () => undefined }));
jest.mock('@/services/offline/networkStatus', () => ({ useNetworkStatus: () => ({ isOffline: false }) }));
jest.mock('@/features/culture/glossary/practice/practiceAudio', () => ({ stopOtherAudio: () => undefined, deleteRecording: () => undefined }));
jest.mock('@/features/culture/komuz/listening/useKomuzPlayerStore', () => ({ useKomuzPlayerStore: jest.requireActual('zustand').create(() => ({ playing: false })) }));
jest.mock('@/features/games/records/useGameRecords', () => {
  const owner = jest.requireActual('zustand').create(() => ({ owner: 'user-a' }));
  return { mockOwner: owner, useRecordsOwner: () => owner((state: { owner: string }) => state.owner) };
});
const mockOwner = (jest.requireMock('@/features/games/records/useGameRecords') as { mockOwner: { setState: (state: { owner: string }) => void } }).mockOwner;
const mockTitles: Record<string, string> = { 'culture_item:boz-uy-tunduk': 'Tunduk', 'culture_item:boz-uy-karkas': 'Karkas', 'culture_item:boz-uy-overview': 'Boz uy' };
jest.mock('@/features/culture/connections/useConnectionContent', () => ({
  useConnectionContent: () => {
    const get = (type: string, id: string) => (mockTitles[`${type}:${id}`] ? { type, id, title: mockTitles[`${type}:${id}`], image: null } : null);
    return { get, all: () => Object.keys(mockTitles).map((key) => get(key.split(':')[0], key.split(':')[1])), exists: (type: string, id: string) => !!get(type, id), isLoading: false, waitingForNetwork: false, retry: () => undefined };
  },
}));
jest.mock('../useMyCollections', () => {
  const actual = jest.requireActual('../useMyCollections');
  return { ...actual, useContentResolver: () => ({ ready: true, resolve: (type: string, id: string) => (mockTitles[`${type}:${id}`] ? { title: mockTitles[`${type}:${id}`], route: `/culture/item/${id}`, thumbnail: null } : null) }) };
});
jest.mock('@/components/ui', () => {
  const { createElement: h } = jest.requireActual('react');
  return {
    AnimatedPressable: (props: Record<string, unknown>) => h('AnimatedPressable', props, props.children),
    Button: (props: Record<string, unknown>) => h('Button', props, props.label),
    IconButton: (props: Record<string, unknown>) => h('IconButton', props),
    TextField: (props: Record<string, unknown>) => h('TextField', props),
    Toggle: (props: Record<string, unknown>) => h('Toggle', props),
    ProgressBar: (props: Record<string, unknown>) => h('ProgressBar', props),
  };
});

const pick = (id: string, title = id) => ({ type: 'culture_item' as const, id, titleSnapshot: title });
const available = (entry: { type: string; id: string }) => !!mockTitles[`${entry.type}:${entry.id}`];
const filled = (): ChallengeDraft => {
  let draft = startDraft('story');
  for (const id of ['boz-uy-tunduk', 'boz-uy-karkas', 'boz-uy-overview']) draft = togglePick(draft, pick(id, mockTitles[`culture_item:${id}`]));
  return setName(setIntro(draft, 'A short synthetic introduction 4f'), 'Synthetic yurt story');
};

describe('the draft', () => {
  it('changing the prompt keeps every pick, caption and word', () => {
    let draft = setCaption(filled(), 'culture_item:boz-uy-karkas', 'My caption');
    const switched = setPrompt(draft, 'compare');
    expect(switched).toMatchObject({ promptId: 'compare', picks: draft.picks, captions: draft.captions, intro: draft.intro, name: draft.name });
    draft = togglePick(switched, pick('boz-uy-karkas'));
    expect(draft.captions).toEqual({}); // its caption goes with the removed pick
    expect(movePick(filled(), 0, 1).picks.map((entry) => entry.id)).toEqual(['boz-uy-karkas', 'boz-uy-tunduk', 'boz-uy-overview']);
  });

  it('at most five picks; concrete requirements only', () => {
    let draft = startDraft('introduce');
    for (let index = 0; index < 7; index += 1) draft = togglePick(draft, pick(`item-${index}`));
    expect(draft.picks).toHaveLength(MAX_PICKS);
    expect(requirements(startDraft('introduce'), available).filter((entry) => !entry.ok).map((entry) => entry.id)).toEqual(['count', 'intro', 'name']);
    expect(requirements(draft, available).find((entry) => entry.id === 'available')).toMatchObject({ ok: false, detail: { missing: draft.picks.map((entry) => `culture_item:${entry.id}`) } });
    expect(complete(filled(), available)).toBe(true);
  });

  it('every suggested connection comes from the dataset', () => {
    const draft = filled();
    for (const connection of connectionsBetween(draft)) expect(connectionById(connection.id)).toBe(connection);
    expect(connectionsBetween(draft).map((connection) => connection.id)).toContain('tunduk-part-of-karkas');
    for (const suggestion of suggestedPicks(draft)) expect(connectionById(suggestion.via.id)).toBe(suggestion.via);
  });

  it('becomes a normal exhibition that survives the existing normalisation', () => {
    const exhibition = toExhibition(setCaption(filled(), 'culture_item:boz-uy-tunduk', 'Light comes in here'));
    const data = { collections: [{ id: 'uc_x', name: 'x', description: null, createdAt: '', updatedAt: '' }], items: exhibition.exhibits.map((key, sortOrder) => ({ collectionId: 'uc_x', contentType: key.split(':')[0] as 'culture_item', contentId: key.split(':')[1], sortOrder, addedAt: '' })) };
    expect(normalizeExhibition(exhibition, data, 'uc_x')).toMatchObject({ title: 'Synthetic yurt story', intro: 'A short synthetic introduction 4f', exhibits: exhibition.exhibits, captions: { 'culture_item:boz-uy-tunduk': 'Light comes in here' } });
    expect(normalizeDraft({ promptId: 'invented', picks: [{ type: 'region', id: 'x' }], captions: { ghost: 'x' } })).toMatchObject({ promptId: 'introduce', picks: [], captions: {} });
  });
});

describe('ownership and saving', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useChallengeDraftStore.setState({ isLoaded: true, saved: {} });
    useMyCollectionsStore.setState({ isLoaded: true, saved: {}, museums: {} });
  });

  it("drafts are per owner: another account can't read one", () => {
    useChallengeDraftStore.getState().put('user-a', filled());
    expect(ownerDraft(useChallengeDraftStore.getState().saved, 'user-b')).toBeNull();
    expect(ownerDraft(useChallengeDraftStore.getState().saved, 'user-a')?.name).toBe('Synthetic yurt story');
  });

  it('a failed save changes nothing; a retry creates the collection and its exhibition', async () => {
    const draft = filled();
    const input = { name: draft.name, items: draft.picks.map((entry) => ({ contentType: entry.type, contentId: entry.id })), exhibition: toExhibition(draft) };
    const real = AsyncStorage.multiSet;
    AsyncStorage.multiSet = () => Promise.reject(new Error('disk full'));
    try {
      expect(await useMyCollectionsStore.getState().createWithExhibition('user-a', input)).toBeNull();
    } finally {
      AsyncStorage.multiSet = real;
    }
    expect(ownerCollections(useMyCollectionsStore.getState().saved, 'user-a').collections).toEqual([]);
    const id = await useMyCollectionsStore.getState().createWithExhibition('user-a', input);
    expect(id).toBeTruthy();
    const data = ownerCollections(useMyCollectionsStore.getState().saved, 'user-a');
    expect(data.items.filter((item) => item.collectionId === id).map((item) => item.contentId)).toEqual(['boz-uy-tunduk', 'boz-uy-karkas', 'boz-uy-overview']);
    expect(normalizeExhibition(ownerExhibition(useMyCollectionsStore.getState().museums, 'user-a', id!), data, id!)?.intro).toBe('A short synthetic introduction 4f');
    expect(ownerCollections(useMyCollectionsStore.getState().saved, 'user-b').collections).toEqual([]);
  });
});

describe('the screen', () => {
  let screen: ReactTestRenderer;
  const all = (testID: string) => screen.root.findAll((node: ReactTestInstance) => node.props.testID === testID && typeof node.type === 'string');
  const has = (testID: string) => all(testID).length > 0;
  const press = (testID: string) => act(async () => { await all(testID)[0].props.onPress(); });
  beforeEach(async () => {
    await AsyncStorage.clear();
    mockOwner.setState({ owner: 'user-a' });
    mockReplace.mockClear();
    useChallengeDraftStore.setState({ isLoaded: true, saved: { 'user-a': filled() } });
    useMyCollectionsStore.setState({ isLoaded: true, saved: {}, museums: {} });
    act(() => {
      screen = create(createElement(CuratorChallengeScreen, { onPressBack: () => undefined }));
    });
  });
  afterEach(() => act(() => screen.unmount()));

  it('save failure keeps the draft and offers retry; success opens the new exhibition and clears the draft', async () => {
    const real = AsyncStorage.multiSet;
    AsyncStorage.multiSet = () => Promise.reject(new Error('disk full'));
    await press('challenge-save');
    AsyncStorage.multiSet = real;
    expect(has('challenge-save-failed')).toBe(true);
    expect(ownerDraft(useChallengeDraftStore.getState().saved, 'user-a')?.picks).toHaveLength(3);
    await press('challenge-retry');
    expect(mockReplace).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/profile/my-collections/museum' }));
    expect(ownerDraft(useChallengeDraftStore.getState().saved, 'user-a')).toBeNull();
  });

  it('preview uses the real guided tour and returns to the same draft', async () => {
    await press('challenge-preview');
    expect(has('tour')).toBe(true);
    expect(has('challenge-preview-banner')).toBe(true);
    await press('challenge-preview-return');
    expect(all('challenge-intro')[0].props.value).toBe('A short synthetic introduction 4f');
  });

  it("another account doesn't see the draft", () => {
    expect(has('challenge-draft')).toBe(true);
    act(() => mockOwner.setState({ owner: 'user-b' }));
    expect(has('challenge-draft')).toBe(false);
    expect(has('challenge-start')).toBe(true);
  });
});
