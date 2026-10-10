/** Through the real Mini Museum screen: the curator's narration plays while visiting, and stops on leaving or switching account. */
import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { memoryNarrationStore, setNarrationAudioStore } from '@/services/museum/narrationAudio';
import { useNarrationPlayer } from '@/services/museum/narrationPlayer';
import { useMyCollectionsStore } from '@/store/useMyCollectionsStore';

import { MiniMuseumScreen } from './MiniMuseumScreen';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));
jest.mock('react-i18next', () => ({ initReactI18next: { type: '3rdParty', init: () => undefined }, useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/services/ageExperience/useAgeExperience', () => ({ useAgeExperience: () => ({ experience: 'adult' }) }));
jest.mock('@/services/a11y/announce', () => ({ announce: () => undefined }));
jest.mock('@/services/share/useShareCard', () => ({ useShareCard: () => ({ share: jest.fn(), shareHost: null, isSharing: false }) }));
jest.mock('@/services/offline/networkStatus', () => ({ useNetworkStatus: () => ({ isOffline: false }) }));
jest.mock('@/features/games/records/useGameRecords', () => {
  const owner = jest.requireActual('zustand').create(() => ({ owner: 'user-a' }));
  return { mockOwner: owner, useRecordsOwner: () => owner((state: { owner: string }) => state.owner) };
});
const mockOwner = (jest.requireMock('@/features/games/records/useGameRecords') as { mockOwner: { setState: (state: { owner: string }) => void } }).mockOwner;
jest.mock('@/features/culture/glossary/practice/practiceAudio', () => ({ stopOtherAudio: () => undefined, deleteRecording: () => undefined }));
jest.mock('@/features/culture/glossary/practice/pronunciation', () => ({ recordingSupport: () => 'needs_app_update' }));
jest.mock('@/features/culture/komuz/listening/useKomuzPlayerStore', () => ({ useKomuzPlayerStore: jest.requireActual('zustand').create(() => ({ playing: false })) }));
jest.mock('expo-audio', () => ({ createAudioPlayer: () => ({ play: () => undefined, pause: () => undefined, remove: () => undefined, addListener: () => ({ remove: () => undefined }) }) }));
jest.mock('../useMyCollections', () => {
  const actual = jest.requireActual('../useMyCollections');
  return { ...actual, useContentResolver: () => ({ ready: true, resolve: (type: string, id: string) => (id === 'boz-uy-tunduk' ? { title: 'Tunduk', route: '/culture/item/boz-uy-tunduk', thumbnail: null } : null) }) };
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
    TextButton: (props: Record<string, unknown>) => h('TextButton', props),
  };
});

const KEY = 'culture_item:boz-uy-tunduk';
let screen: ReactTestRenderer;
const has = (testID: string) => screen.root.findAll((node) => node.props.testID === testID).length > 0;
const press = (testID: string) =>
  act(async () => {
    await screen.root.findAll((node) => node.props.testID === testID && typeof node.props.onPress === 'function')[0].props.onPress();
  });

let audioId = '';
beforeEach(async () => {
  const store = memoryNarrationStore();
  setNarrationAudioStore(store);
  mockOwner.setState({ owner: 'user-a' });
  useMyCollectionsStore.setState({ isLoaded: true, saved: {}, museums: {} });
  const collections = useMyCollectionsStore.getState();
  const collection = collections.create('user-a', { name: 'Synthetic 6v' });
  collections.add('user-a', collection.id, 'culture_item', 'boz-uy-tunduk');
  audioId = await store.save('user-a', 'blob:take');
  collections.saveExhibition('user-a', collection.id, { title: 'T', intro: '', exhibits: [KEY], captions: {}, narrations: { [KEY]: { audioId, durationMs: 4000, text: 'Transcript 3w' } }, updatedAt: '' });
  act(() => {
    screen = create(createElement(MiniMuseumScreen, { collectionId: collection.id, onPressBack: () => undefined }));
  });
});
afterEach(() => {
  act(() => screen.unmount());
  setNarrationAudioStore(null);
});

it('visiting shows the labelled narration and its transcript; ending the presentation stops it', async () => {
  await press('museum-present');
  expect(has('narration-visitor')).toBe(true);
  expect(has('narration-visitor-text')).toBe(true);
  await press('narration-play');
  expect(useNarrationPlayer.getState().playingId).toBe(audioId);
  await press('museum-finish');
  expect(useNarrationPlayer.getState().playingId).toBeNull();
});

it('switching account stops it, and the new account sees no narration', async () => {
  await press('museum-present');
  await press('narration-play');
  expect(useNarrationPlayer.getState().playingId).toBe(audioId);
  act(() => mockOwner.setState({ owner: 'user-b' }));
  expect(useNarrationPlayer.getState().playingId).toBeNull();
  expect(has('narration-visitor')).toBe(false);
  expect(has('narration-play')).toBe(false);
});

it('leaving the exhibition stops it', async () => {
  await press('museum-present');
  await press('narration-play');
  act(() => screen.unmount());
  expect(useNarrationPlayer.getState().playingId).toBeNull();
  act(() => {
    screen = create(createElement('View'));
  });
});

it('editing without recording support still offers written narration', async () => {
  await press('museum-narration-0');
  expect(has('narration-unavailable')).toBe(true);
  expect(has('narration-text')).toBe(true);
});
