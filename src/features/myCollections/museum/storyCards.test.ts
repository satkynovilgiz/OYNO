import AsyncStorage from '@react-native-async-storage/async-storage';
import { createElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import { ShareCard } from '@/components/share/ShareCard';
import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import { MY_MUSEUMS_KEY, ownerCollections, ownerExhibition, useMyCollectionsStore } from '@/store/useMyCollectionsStore';

import { MiniMuseumScreen } from './MiniMuseumScreen';
import { normalizeExhibition, slidesFor, type Exhibition } from './museumModel';
import { STORY_CARD_SIZE, StoryCardView } from './StoryCards';
import { addCard, canTell, CARD_TEXT_MAX, CARD_TITLE_MAX, cardContent, EMPTY_STORY, endStoryPlace, keepStoryPlace, moveCard, normalizeStory, partOf, removeCard, resumeStoryPlace, setCardWords, STORY_MAX, storySlides, type Story } from './storyModel';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));
jest.mock('react-i18next', () => ({ initReactI18next: { type: '3rdParty', init: () => undefined }, useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/services/ageExperience/useAgeExperience', () => ({ useAgeExperience: () => ({ experience: 'adult' }) }));
jest.mock('@/services/a11y/announce', () => ({ announce: () => undefined }));
jest.mock('@/services/offline/networkStatus', () => ({ useNetworkStatus: () => ({ isOffline: false }) }));
jest.mock('@/features/games/records/useGameRecords', () => ({ useRecordsOwner: () => 'guest' }));
const mockShare: { calls: { content: { artwork: unknown; cardSize: unknown }; fallback: string }[] } = { calls: [] };
jest.mock('@/services/share/useShareCard', () => ({ useShareCard: () => ({ share: async (content: never, fallback: string) => void mockShare.calls.push({ content, fallback }), shareHost: null, isSharing: false }) }));
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
const mockContent: Record<string, { title: string; route: string; thumbnail: null }> = {
  'culture_item:boz-uy-overview': { title: 'Боз үй', route: '/culture/item/boz-uy-overview', thumbnail: null },
  'culture_item:boz-uy-tunduk': { title: 'Түндүк', route: '/culture/item/boz-uy-tunduk', thumbnail: null },
  'culture_item:shyrdak-craft': { title: 'Шырдак', route: '/culture/item/shyrdak-craft', thumbnail: null },
  'culture_item:horse-eer': { title: 'Ээр', route: '/culture/item/horse-eer', thumbnail: null },
};
jest.mock('../useMyCollections', () => ({ ...jest.requireActual('../useMyCollections'), useContentResolver: () => ({ ready: true, resolve: (type: string, id: string) => mockContent[`${type}:${id}`] ?? null }) }));

const KEYS = ['culture_item:boz-uy-overview', 'culture_item:boz-uy-tunduk', 'culture_item:shyrdak-craft', 'culture_item:horse-eer', 'culture_item:gone'];
const resolve = (type: string, id: string) => mockContent[`${type}:${id}`] ?? null;
const exhibition: Exhibition = { title: 'Yurt story', intro: '', exhibits: KEYS, captions: {}, updatedAt: '' };
const slides = slidesFor(exhibition, resolve, true);
const three = (): Story => [KEYS[0], KEYS[1], KEYS[2]].reduce((story, key) => addCard(story, key, true), EMPTY_STORY);
const PRIVATE = 'Private collection description 6v';

describe('ordering', () => {
  it('cards in the curator order; parts follow it (first = beginning, last = ending)', () => {
    let story = three();
    expect(story.cards.map((card) => card.key)).toEqual(KEYS.slice(0, 3));
    story = moveCard(story, 2, -1);
    expect(story.cards.map((card) => card.key)).toEqual([KEYS[0], KEYS[2], KEYS[1]]);
    expect(moveCard(story, 0, -1)).toBe(story);
    expect([0, 1, 2].map((index) => partOf(index, 3))).toEqual(['beginning', 'middle', 'ending']);
    expect([0, 1, 2, 3, 4, 5].map((index) => partOf(index, 6))).toEqual(['beginning', 'middle', 'middle', 'middle', 'middle', 'ending']);
    expect(canTell(removeCard(story, KEYS[0]))).toBe(false);
  });

  it('at most six, each exhibit once, only exhibits that can be shown', () => {
    let story = EMPTY_STORY;
    for (let index = 0; index < 8; index += 1) story = addCard(story, `culture_item:x${index}`, true);
    expect(story.cards).toHaveLength(STORY_MAX);
    expect(addCard(three(), KEYS[0], true).cards).toHaveLength(3);
    expect(addCard(three(), KEYS[4], false).cards).toHaveLength(3);
  });
});

describe('text limits and stored data', () => {
  it('title and words are bounded and stripped of markup; tampered stories are cleaned on read', () => {
    let story = setCardWords(three(), KEYS[1], { title: 'T'.repeat(90), text: '<b>x</b>'.repeat(80) });
    expect(story.cards[1].title).toHaveLength(CARD_TITLE_MAX);
    expect(story.cards[1].text.length).toBeLessThanOrEqual(CARD_TEXT_MAX);
    expect(story.cards[1].text).not.toMatch(/[<>]/);
    expect(setCardWords(story, 'culture_item:not-a-card', { title: 'x' })).toBe(story);
    story = normalizeStory({ cards: [{ key: KEYS[0], title: 1, text: null }, { key: KEYS[0], title: 'dup' }, { key: 'culture_item:not-in-exhibition' }, ...KEYS.slice(1).map((key) => ({ key, title: 't', text: 'w' })), { key: 'x' }] }, exhibition);
    expect(story.cards.map((card) => card.key)).toEqual(KEYS);
    expect(story.cards[0]).toEqual({ key: KEYS[0], title: '', text: '' });
    expect(normalizeStory('nope', exhibition)).toEqual(EMPTY_STORY);
  });
});

describe('missing content', () => {
  it('a removed exhibit stays in the story as a clear card; the rest are unaffected', () => {
    const story: Story = { cards: [{ key: KEYS[0], title: 'a', text: '' }, { key: KEYS[4], title: 'gone one', text: 'w' }, { key: KEYS[1], title: 'c', text: '' }] };
    const told = storySlides(story, slides);
    expect(told.map((slide) => [slide.part, slide.exhibit?.kind])).toEqual([['beginning', 'exhibit'], ['middle', 'removed'], ['ending', 'exhibit']]);
    expect(cardContent(told[1])).toMatchObject({ exhibitTitle: null, picture: null, cardTitle: 'gone one' });
  });
});

describe('exported cards contain only the previewed content', () => {
  it('the card is built from five fields only, and the exported tree equals the preview', () => {
    const story = setCardWords(three(), KEYS[1], { title: 'The crown', text: 'Light comes in here.' });
    const content = cardContent(storySlides(story, slides)[1]);
    expect(Object.keys(content).sort()).toEqual(['cardTitle', 'exhibitTitle', 'part', 'picture', 'text']);
    let preview: ReactTestRenderer | null = null;
    let exported: ReactTestRenderer | null = null;
    act(() => {
      preview = create(createElement(StoryCardView, { content }));
      exported = create(createElement(ShareCard, { variant: 'postcard', title: 't', label: 'l', imageSource: null, cardSize: STORY_CARD_SIZE, artwork: createElement(StoryCardView, { content }) }));
    });
    const tree = exported!.toJSON() as unknown as { props: { style: Record<string, number> }; children: unknown[] };
    expect(tree.props.style).toMatchObject(STORY_CARD_SIZE);
    expect(JSON.stringify(tree.children[0])).toBe(JSON.stringify(preview!.toJSON()));
    const text = JSON.stringify(preview!.toJSON());
    expect(text).toContain('The crown');
    expect(text).toContain('Түндүк');
      });
});

describe('owner isolation, persistence and the real screen', () => {
  let screen: ReactTestRenderer;
  let collectionId = '';
  const all = (testID: string): ReactTestInstance[] => screen.root.findAll((node) => node.props.testID === testID && (node.props.onPress || node.props.onChangeText));
  const press = (testID: string) => act(() => all(testID)[0].props.onPress());
  const words = () => {
    const parts: string[] = [];
    const walk = (node: ReactTestInstance | string) => (typeof node === 'string' ? parts.push(node) : (Object.values(node.props).forEach((value) => typeof value === 'string' && parts.push(value)), node.children.forEach(walk)));
    walk(screen.root);
    return parts.join(' | ');
  };

  beforeEach(async () => {
    endStoryPlace();
    mockShare.calls = [];
    await AsyncStorage.clear();
    useMyCollectionsStore.setState({ isLoaded: true, saved: {}, museums: {} });
    const store = useMyCollectionsStore.getState();
    const collection = store.create('guest', { name: 'Yurt things', description: PRIVATE });
    for (const key of KEYS) store.add('guest', collection.id, 'culture_item', key.split(':')[1]);
    collectionId = collection.id;
    act(() => {
      screen = create(createElement(MiniMuseumScreen, { collectionId, onPressBack: () => undefined }));
    });
  });
  afterEach(() => act(() => screen.unmount()));

  it('authoring saves to the owner-bound exhibition, survives a restart, and another account sees nothing', async () => {
    for (const key of [KEYS[0], KEYS[2], KEYS[1]]) press(`story-add-${key}`);
    act(() => all('story-text-1')[0].props.onChangeText('Felt in the middle.'));
    press('story-down-0');
    const story = () => (ownerExhibition(useMyCollectionsStore.getState().museums, 'guest', collectionId) as Exhibition).story!;
    expect(story().cards.map((card) => card.key)).toEqual([KEYS[2], KEYS[0], KEYS[1]]);
    expect(story().cards[0].text).toBe('Felt in the middle.');
    expect(ownerExhibition(useMyCollectionsStore.getState().museums, 'user-b', collectionId)).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await act(async () => {
      useMyCollectionsStore.setState({ isLoaded: false, museums: {}, saved: {} });
      await useMyCollectionsStore.getState().load();
    });
    const reloaded = normalizeExhibition(ownerExhibition(useMyCollectionsStore.getState().museums, 'guest', collectionId), ownerCollections(useMyCollectionsStore.getState().saved, 'guest'), collectionId)!;
    expect(reloaded.story!.cards.map((card) => card.key)).toEqual([KEYS[2], KEYS[0], KEYS[1]]);
    expect((await AsyncStorage.getItem(MY_MUSEUMS_KEY)) ?? '').toContain('Felt in the middle.');
  });

  it('presenting: manual Next/Previous, a list alternative, the private description never shown, export keeps everything', () => {
    for (const key of [KEYS[0], KEYS[1], KEYS[2]]) press(`story-add-${key}`);
    press('story-present');
    expect(all('story-next').length).toBeGreaterThan(0);
    press('story-next');
    expect(words()).toContain('museum.story.cardOf');
    press('story-toggle-list');
    expect(screen.root.findAll((node) => node.props.testID === 'story-slide-2').length).toBeGreaterThan(0);
    press('story-toggle-list');
    press('story-export');
    expect(mockShare.calls).toHaveLength(1);
    expect(mockShare.calls[0].content.cardSize).toEqual(STORY_CARD_SIZE);
    expect(JSON.stringify(mockShare.calls[0])).not.toContain(PRIVATE);
    expect(words()).not.toContain(PRIVATE);
    // Export (whatever its outcome) changed nothing: same card selected, same story.
    expect(resumeStoryPlace('guest', collectionId)?.index).toBe(1);
    expect((ownerExhibition(useMyCollectionsStore.getState().museums, 'guest', collectionId) as Exhibition).story!.cards).toHaveLength(3);
  });

  it('the place in the story survives the screen being re-created (opening a source)', () => {
    for (const key of [KEYS[0], KEYS[1], KEYS[2]]) press(`story-add-${key}`);
    press('story-present');
    press('story-next');
    press('story-next');
    act(() => screen.unmount());
    act(() => {
      screen = create(createElement(MiniMuseumScreen, { collectionId, onPressBack: () => undefined }));
    });
    expect(screen.root.findAll((node) => node.props.testID === 'story-slide-2').length).toBeGreaterThan(0);
    keepStoryPlace('someone-else', collectionId, 0, false);
    expect(resumeStoryPlace('guest', collectionId)).toBeNull();
  });
});

describe('texts', () => {
  it('KG/RU/EN for every part and note', () => {
    for (const lang of [en, ru, kg]) {
      const story = (lang as unknown as { museum: { story: { parts: Record<string, string>; curatorWords: string; webNote: string; exportNote: string } } }).museum.story;
      for (const part of ['beginning', 'middle', 'ending']) expect(story.parts[part]).toBeTruthy();
      expect(story.curatorWords && story.webNote && story.exportNote).toBeTruthy();
    }
  });
});
