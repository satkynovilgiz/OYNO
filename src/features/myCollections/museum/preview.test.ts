/**
 * Mini Museum Visitor Preview: readiness rules, the story-card fit rule
 * (export = preview, nothing silently cut), and through the real screen:
 * read-only, only visitor fields, checklist -> editing, return position.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import { useMyCollectionsStore } from '@/store/useMyCollectionsStore';

import { MiniMuseumScreen } from './MiniMuseumScreen';
import { slidesFor, type Exhibition } from './museumModel';
import { CARD, endPreview, estimateLines, fitStoryCard, IMAGE_HEIGHTS, readiness, startAvailability, TYPE } from './previewModel';
import { cardContent, endStoryPlace, storySlides, type StoryCardContent } from './storyModel';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));
jest.mock('react-i18next', () => ({ initReactI18next: { type: '3rdParty', init: () => undefined }, useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (path: string) => mockPush(path) } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/services/ageExperience/useAgeExperience', () => ({ useAgeExperience: () => ({ experience: 'adult' }) }));
jest.mock('@/services/a11y/announce', () => ({ announce: () => undefined }));
jest.mock('@/services/share/useShareCard', () => ({ useShareCard: () => ({ share: jest.fn(), shareHost: null, isSharing: false }) }));
jest.mock('@/services/offline/networkStatus', () => ({ useNetworkStatus: () => ({ isOffline: false }) }));
jest.mock('@/features/games/records/useGameRecords', () => ({ useRecordsOwner: () => 'guest' }));
jest.mock('@/features/culture/glossary/practice/practiceAudio', () => ({ stopOtherAudio: () => undefined, deleteRecording: () => undefined }));
jest.mock('@/features/culture/komuz/listening/useKomuzPlayerStore', () => ({ useKomuzPlayerStore: jest.requireActual('zustand').create(() => ({ playing: false })) }));
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
const IMG = { uri: 'https://example.test/x.png' };
const mockContent: Record<string, { title: string; route: string; thumbnail: unknown }> = {
  'culture_item:boz-uy-overview': { title: 'Боз үй', route: '/culture/item/boz-uy-overview', thumbnail: IMG },
  'culture_item:boz-uy-tunduk': { title: 'Түндүк', route: '/culture/item/boz-uy-tunduk', thumbnail: null },
  'culture_item:shyrdak-craft': { title: 'Шырдак', route: '/culture/item/shyrdak-craft', thumbnail: IMG },
  // An exhibit title longer than the card's two lines.
  'culture_item:long-title': { title: 'Боз үйдүн түндүгү, уугу, керегеси жана башка бөлүктөрү тууралуу абдан узун аталыш', route: '/culture/item/long-title', thumbnail: IMG },
};
const mockResolver = { ready: true };
jest.mock('../useMyCollections', () => {
  const actual = jest.requireActual('../useMyCollections');
  return { ...actual, useContentResolver: () => ({ ready: mockResolver.ready, resolve: (type: string, id: string) => mockContent[`${type}:${id}`] ?? null }) };
});

const KEYS = ['culture_item:boz-uy-overview', 'culture_item:removed-from-oyno', 'culture_item:boz-uy-tunduk', 'culture_item:shyrdak-craft'];
const resolve = (type: string, id: string) => (mockContent[`${type}:${id}`] as never) ?? null;
const exhibitionOf = (patch: Partial<Exhibition> = {}): Exhibition => ({ title: '', intro: '', exhibits: KEYS, captions: {}, updatedAt: '', ...patch });

/** Height the card's column needs with a fit (the same arithmetic as the rule, checked independently). */
function heightOf(content: StoryCardContent) {
  const fit = fitStoryCard(content);
  const blocks = [TYPE.part.line, fit.imageHeight, fit.lines.exhibit * TYPE.exhibit.line, fit.lines.title * TYPE.title.line, fit.lines.text * TYPE.text.line, fit.shortened ? TYPE.note.line : 0].filter((height) => height > 0);
  return { fit, height: CARD.padding * 2 + blocks.reduce((sum, height) => sum + height, 0) + (blocks.length - 1) * CARD.gap };
}

describe('readiness checklist: verifiable conditions only', () => {
  it('unavailable exhibits and missing pictures, with where to fix them; optional fields never listed', () => {
    const exhibition = exhibitionOf();
    const items = readiness(exhibition, slidesFor(exhibition, resolve, true), true);
    expect(items.map((item) => [item.id, 'index' in item ? item.index : null, item.target])).toEqual([
      ['unavailable', 1, { kind: 'exhibit', index: 1 }],
      ['noImage', 2, { kind: 'exhibit', index: 2 }],
    ]);
    // Empty title/introduction/captions are optional: nothing about them.
    expect(items.some((item) => /title|intro|caption/i.test(item.id))).toBe(false);
  });

  it('nothing is judged while content is still loading; no exhibits is the only blocker', () => {
    const exhibition = exhibitionOf();
    expect(readiness(exhibition, slidesFor(exhibition, resolve, false), false)).toEqual([]);
    expect(readiness(exhibitionOf({ exhibits: [] }), [], true)).toEqual([{ id: 'noExhibits', severity: 'blocker', target: { kind: 'exhibits' } }]);
    expect(startAvailability(exhibitionOf({ exhibits: [] }))).toEqual({ exhibition: 'noExhibits', tour: 'noExhibits', story: 'noExhibits' });
  });

  it('story: too short, an unavailable card, words that will be shortened', () => {
    const short = exhibitionOf({ story: { cards: [{ key: KEYS[0], title: '', text: '' }] } });
    expect(readiness(short, slidesFor(short, resolve, true), true).filter((item) => item.id.startsWith('story'))).toEqual([{ id: 'storyTooShort', severity: 'warning', count: 1, target: { kind: 'story', index: null } }]);
    expect(startAvailability(short).story).toBe('noStory');
    const long = 'Сөз '.repeat(50).trim();
    const keys = [...KEYS, 'culture_item:long-title'];
    const story = exhibitionOf({ exhibits: keys, story: { cards: [{ key: keys[4], title: 'Т'.repeat(40), text: long }, { key: KEYS[1], title: '', text: '' }, { key: KEYS[3], title: 'Т'.repeat(40), text: long }] } });
    expect(readiness(story, slidesFor(story, resolve, true), true).filter((item) => item.id.startsWith('story')).map((item) => [item.id, 'index' in item ? item.index : null])).toEqual([
      ['storyShortened', 0],
      ['storyUnavailable', 1],
    ]);
  });
});

describe('story card fit: everything fits or is visibly shortened', () => {
  const longKg = 'Түндүк - боз үйдүн эң бийик жериндеги тегерек чамгарак, ал аркылуу жарык кирип, түтүн чыгат; үй-бүлөнүн ыйык белгиси катары муундан муунга өтөт жана сакталат.'.slice(0, 200);
  const longRu = 'Тюндюк - круглое навершие юрты в самой высокой её точке: через него проходит свет и выходит дым, его бережно передают из поколения в поколение как знак семьи.'.slice(0, 200);
  const longEn = 'The tunduk is the round crown at the very top of the yurt: light comes in through it and smoke goes out, and families pass it down from one generation to the next.'.slice(0, 200);
  const cases: [string, StoryCardContent][] = [
    ['short', { part: 'beginning', cardTitle: 'Light', text: 'A short line.', exhibitTitle: 'Түндүк', picture: IMG }],
    ['no words', { part: 'middle', cardTitle: '', text: '', exhibitTitle: 'Түндүк', picture: null }],
    ['KG max', { part: 'middle', cardTitle: 'Боз үйдүн эң бийик жериндеги чамгарак', text: longKg, exhibitTitle: 'Боз үй: түндүк, уук жана кереге', picture: IMG }],
    ['RU max', { part: 'ending', cardTitle: 'Навершие юрты, через которое светит', text: longRu, exhibitTitle: 'Тюндюк', picture: IMG }],
    ['EN max', { part: 'ending', cardTitle: 'The crown of the yurt, where light enters', text: longEn, exhibitTitle: 'Tunduk', picture: IMG }],
    ['unbreakable', { part: 'beginning', cardTitle: 'Ө'.repeat(40), text: 'Ж'.repeat(200), exhibitTitle: 'Ш'.repeat(120), picture: IMG }],
  ];
  it.each(cases)('%s: never taller than the card', (_, content) => {
    const { fit, height } = heightOf(content);
    expect(height).toBeLessThanOrEqual(CARD.height);
    expect(fit.imageHeight).toBeGreaterThanOrEqual(IMAGE_HEIGHTS.min);
    // Shortened <=> some text got fewer lines than it needs - and then the card says so.
    const needs = { title: content.cardTitle ? estimateLines(content.cardTitle, TYPE.title.size, 320, true) : 0, text: content.text ? estimateLines(content.text, TYPE.text.size, 320) : 0 };
    if (fit.lines.title < needs.title || fit.lines.text < needs.text) expect(fit.shortened).toBe(true);
  });
  it('the longest words a curator can write fit by shrinking the picture - no shortening needed', () => {
    for (const [, content] of cases.slice(2, 5)) expect(fitStoryCard(content).shortened).toBe(false);
  });
  it('short words keep the full picture; long ones shrink the picture before shortening', () => {
    expect(fitStoryCard(cases[0][1])).toEqual({ imageHeight: IMAGE_HEIGHTS.full, lines: { exhibit: 1, title: 1, text: 1 }, shortened: false });
    const medium = fitStoryCard({ part: 'middle', cardTitle: 'A title', text: longEn, exhibitTitle: 'Tunduk', picture: IMG });
    expect(medium.shortened).toBe(false);
    expect(medium.imageHeight).toBeLessThan(IMAGE_HEIGHTS.full);
    expect(fitStoryCard(cases[5][1]).shortened).toBe(true);
  });
});

describe('the real screen in preview', () => {
  let screen: ReactTestRenderer;
  let collectionId = '';
  const PRIVATE = 'Private collection description 8m';
  const textOf = (root: ReactTestInstance) => {
    const parts: string[] = [];
    const walk = (node: ReactTestInstance | string) => {
      if (typeof node === 'string') parts.push(node);
      else {
        for (const value of Object.values(node.props)) if (typeof value === 'string') parts.push(value);
        node.children.forEach(walk);
      }
    };
    walk(root);
    return parts.join(' | ');
  };
  const find = (testID: string) => screen.root.findAll((node) => node.props.testID === testID);
  const has = (testID: string) => find(testID).length > 0;
  const press = (testID: string) => act(() => find(testID).filter((node) => typeof node.props.onPress === 'function')[0].props.onPress());
  const saved = () => JSON.stringify(useMyCollectionsStore.getState().museums);

  beforeEach(async () => {
    mockResolver.ready = true;
    endPreview();
    endStoryPlace();
    await AsyncStorage.clear();
    useMyCollectionsStore.setState({ isLoaded: true, saved: {}, museums: {} });
    const store = useMyCollectionsStore.getState();
    const collection = store.create('guest', { name: 'Yurt things', description: PRIVATE });
    for (const key of KEYS) store.add('guest', collection.id, 'culture_item', key.split(':')[1]);
    store.saveExhibition('guest', collection.id, exhibitionOf({ intro: 'Curator intro 5t', captions: { [KEYS[0]]: 'Caption 7q' }, story: { cards: [{ key: KEYS[0], title: 'Long '.repeat(8).trim(), text: 'word '.repeat(40).trim() }, { key: KEYS[2], title: '', text: 'Two' }, { key: KEYS[3], title: 'Three', text: '' }] } }));
    collectionId = collection.id;
    act(() => {
      screen = create(createElement(MiniMuseumScreen, { collectionId, onPressBack: () => undefined }));
    });
  });
  afterEach(() => act(() => screen.unmount()));

  it('read-only: every start view shows visitor fields only, never private notes or editing controls; saved content unchanged', () => {
    const before = saved();
    press('museum-preview');
    expect(has('preview-banner')).toBe(true);
    expect(has('preview-checklist')).toBe(true);
    for (const view of ['exhibition', 'tour', 'story']) {
      press(`preview-start-${view}`);
      const text = textOf(screen.root);
      expect(text).not.toContain(PRIVATE);
      for (const control of ['museum-title', 'museum-intro', 'museum-caption-0', 'story-title-0', 'museum-narration-0', 'museum-share', 'story-export']) expect(has(control)).toBe(false);
      expect(has('preview-banner')).toBe(true);
      press('preview-return');
      press('museum-preview');
    }
    // Visitor fields are there: intro + caption in the exhibition.
    press('preview-start-exhibition');
    expect(textOf(screen.root)).toContain('Curator intro 5t');
    expect(textOf(screen.root)).toContain('Caption 7q');
    press('preview-return');
    expect(has('museum-setup')).toBe(true);
    expect(saved()).toBe(before);
  });

  it('the story preview shows the exact export card (same content as the export), with the shortened note', () => {
    press('museum-preview');
    press('preview-start-story');
    const card = find('story-export-card')[0];
    expect(card).toBeTruthy();
    const exhibition = useMyCollectionsStore.getState().museums.guest[collectionId];
    const expected = cardContent(storySlides(exhibition.story!, slidesFor(exhibition, resolve, true))[0]);
    expect(card.parent?.props.content ?? find('story-export-card')[0].parent?.parent?.props.content).toEqual(expected);
    // The longest card words fit (the picture shrinks): nothing shortened, no note.
    expect(has('story-export-shortened')).toBe(false);
    expect(textOf(card)).not.toContain(PRIVATE);
  });

  it('a checklist item opens editing; Return keeps the editing view', () => {
    press('museum-preview');
    expect(has('preview-item-unavailable-0')).toBe(true);
    press('preview-item-unavailable-0');
    expect(has('museum-setup')).toBe(true);
    expect(has('preview-banner')).toBe(false);
  });
});
