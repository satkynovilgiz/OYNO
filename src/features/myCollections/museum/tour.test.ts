/**
 * Mini Museum visitor mode: curator order, navigation, missing content,
 * reflections, and that private fields never reach the tour - driven
 * through the pure model and the real Mini Museum screen.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import { ownerExhibition, useMyCollectionsStore } from '@/store/useMyCollectionsStore';

import { MiniMuseumScreen } from './MiniMuseumScreen';
import { normalizeExhibition, REFLECTION_PROMPTS, setReflection, slidesFor, toggleExhibit, type Exhibition } from './museumModel';
import { buildTour, closingRows, START_TOUR, tourExhibits, tourReducer, type TourState, type TourStep } from './tourModel';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));
jest.mock('react-i18next', () => ({ initReactI18next: { type: '3rdParty', init: () => undefined }, useTranslation: () => ({ t: (key: string, options?: Record<string, unknown>) => (options && 'name' in options ? `${key}:${options.name}` : key) }) }));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/services/ageExperience/useAgeExperience', () => ({ useAgeExperience: () => ({ experience: 'adult' }) }));
jest.mock('@/services/a11y/announce', () => ({ announce: () => undefined }));
jest.mock('@/services/share/useShareCard', () => ({ useShareCard: () => ({ share: jest.fn(), shareHost: null, isSharing: false }) }));
jest.mock('@/services/offline/networkStatus', () => ({ useNetworkStatus: () => ({ isOffline: false }) }));
jest.mock('@/features/games/records/useGameRecords', () => ({ useRecordsOwner: () => 'guest' }));
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
// Content: three real items and one that is gone from OYNO.
const mockContent: Record<string, { title: string; route: string; thumbnail: null }> = {
  'culture_item:boz-uy-overview': { title: 'Боз үй', route: '/culture/item/boz-uy-overview', thumbnail: null },
  'culture_item:boz-uy-tunduk': { title: 'Түндүк', route: '/culture/item/boz-uy-tunduk', thumbnail: null },
  'culture_item:shyrdak-craft': { title: 'Шырдак', route: '/culture/item/shyrdak-craft', thumbnail: null },
};
jest.mock('../useMyCollections', () => {
  const actual = jest.requireActual('../useMyCollections');
  return { ...actual, useContentResolver: () => ({ ready: true, resolve: (type: string, id: string) => mockContent[`${type}:${id}`] ?? null }) };
});

const KEYS = ['culture_item:boz-uy-overview', 'culture_item:removed-from-oyno', 'culture_item:boz-uy-tunduk', 'culture_item:shyrdak-craft'];
const exhibitionOf = (patch: Partial<Exhibition> = {}): Exhibition => ({ title: 'Yurt', intro: 'Curator intro 5t', exhibits: KEYS, captions: { 'culture_item:boz-uy-tunduk': 'Caption 7q' }, reflections: { 'culture_item:boz-uy-tunduk': 'detail', 'culture_item:removed-from-oyno': 'reminds' }, updatedAt: '', ...patch });
const resolve = (type: string, id: string) => mockContent[`${type}:${id}`] ?? null;
const steps = (exhibition = exhibitionOf(), offline = false) => buildTour(exhibition, tourExhibits(slidesFor(exhibition, resolve, true), offline));
const run = (tour: TourStep[], ...actions: Parameters<typeof tourReducer>[2][]) => actions.reduce((state: TourState, action) => tourReducer(tour, state, action), START_TOUR);

describe('order and steps', () => {
  it("follows the curator's order: welcome, exhibits (reflection after the chosen visible ones), closing", () => {
    expect(steps().map((step) => (step.kind === 'exhibit' ? `exhibit:${step.exhibit.key.split(':')[1]}:${step.exhibit.kind}` : step.kind === 'reflection' ? `reflection:${step.prompt}` : step.kind))).toEqual([
      'welcome',
      'exhibit:boz-uy-overview:exhibit',
      'exhibit:removed-from-oyno:removed',
      'exhibit:boz-uy-tunduk:exhibit',
      'reflection:detail',
      'exhibit:shyrdak-craft:exhibit',
      'closing',
    ]);
    // Reordering in the curator's setup reorders the tour.
    const reordered = steps(exhibitionOf({ exhibits: [...KEYS].reverse() }));
    expect(reordered.filter((step) => step.kind === 'exhibit').map((step) => (step as Extract<TourStep, { kind: 'exhibit' }>).exhibit.key)).toEqual([...KEYS].reverse());
  });

  it('a removed exhibit is a clear step that never blocks; offline content is "not on this device", not removed', () => {
    const tour = steps();
    const state = run(tour, { type: 'next' }, { type: 'next' }, { type: 'next' });
    expect(tour[state.index]).toMatchObject({ kind: 'exhibit', exhibit: { kind: 'exhibit', key: 'culture_item:boz-uy-tunduk' } });
    const offline = steps(exhibitionOf(), true);
    expect(offline[2]).toMatchObject({ kind: 'exhibit', exhibit: { kind: 'offline' } });
  });
});

describe('navigation', () => {
  it('Next skips a reflection; Previous and jumps return to earlier exhibits; nothing moves on its own', () => {
    const tour = steps();
    let state = run(tour, { type: 'next' }, { type: 'next' }, { type: 'next' }, { type: 'next' });
    expect(tour[state.index].kind).toBe('reflection');
    state = tourReducer(tour, state, { type: 'next' }); // skip without answering
    expect(tour[state.index]).toMatchObject({ kind: 'exhibit', exhibit: { key: 'culture_item:shyrdak-craft' } });
    expect(state.responses).toEqual({});
    state = tourReducer(tour, state, { type: 'previous' });
    state = tourReducer(tour, state, { type: 'goTo', index: 1 });
    expect(tour[state.index]).toMatchObject({ kind: 'exhibit', exhibit: { key: 'culture_item:boz-uy-overview' } });
    // Bounds: no step before the welcome or past the closing.
    expect(tourReducer(tour, START_TOUR, { type: 'previous' })).toBe(START_TOUR);
    const end = run(tour, ...Array.from({ length: 20 }, () => ({ type: 'next' as const })));
    expect(tour[end.index].kind).toBe('closing');
  });

  it('a response is optional, only typed on its reflection, bounded, and gone after restart', () => {
    const tour = steps();
    let state = run(tour, { type: 'next' });
    expect(tourReducer(tour, state, { type: 'respond', key: 'culture_item:boz-uy-tunduk', text: 'x' })).toBe(state);
    state = run(tour, { type: 'next' }, { type: 'next' }, { type: 'next' }, { type: 'next' });
    state = tourReducer(tour, state, { type: 'respond', key: 'culture_item:boz-uy-tunduk', text: 'y'.repeat(900) });
    expect(state.responses['culture_item:boz-uy-tunduk']).toHaveLength(500);
    expect(tourReducer(tour, state, { type: 'restart' })).toEqual(START_TOUR);
  });

  it('closing: every exhibit in order with whether it was viewed and its source link', () => {
    const tour = steps();
    const state = run(tour, { type: 'next' }, { type: 'next' }, { type: 'next' }, { type: 'goTo', index: tour.length - 1 });
    expect(closingRows(tour, state).map((row) => [row.key.split(':')[1], row.status, row.viewed, row.route])).toEqual([
      ['boz-uy-overview', 'exhibit', true, '/culture/item/boz-uy-overview'],
      ['removed-from-oyno', 'removed', true, null],
      ['boz-uy-tunduk', 'exhibit', true, '/culture/item/boz-uy-tunduk'],
      ['shyrdak-craft', 'exhibit', false, '/culture/item/shyrdak-craft'],
    ]);
  });
});

describe('reflections are curator-chosen authored prompts', () => {
  it('only known prompts, only on shown exhibits; removing an exhibit removes its prompt; old exhibitions load without any', () => {
    const data = { collections: [{ id: 'c', name: 'n', description: null, createdAt: '', updatedAt: '' }], items: KEYS.map((key, sortOrder) => ({ collectionId: 'c', contentType: 'culture_item', contentId: key.split(':')[1], sortOrder, addedAt: '' })) } as never;
    expect(normalizeExhibition({ title: 't', intro: '', exhibits: KEYS, captions: {}, reflections: { [KEYS[0]]: 'made-up-fact', [KEYS[2]]: 'today', 'culture_item:not-shown': 'detail' }, updatedAt: '' }, data, 'c')?.reflections).toEqual({ [KEYS[2]]: 'today' });
    expect(normalizeExhibition({ title: 't', intro: '', exhibits: KEYS, captions: {}, updatedAt: '' }, data, 'c')?.reflections).toEqual({});
    const withPrompt = setReflection(exhibitionOf(), KEYS[0], 'share');
    expect(toggleExhibit(withPrompt, KEYS[0]).reflections?.[KEYS[0]]).toBeUndefined();
    expect(setReflection(exhibitionOf(), 'culture_item:not-shown', 'share')).toEqual(exhibitionOf());
  });

  it('every prompt is written in KG, RU and EN, and the tour says they are prompts, not facts', () => {
    for (const lang of [en, ru, kg]) {
      const visit = (lang as unknown as { museum: { visit: { prompts: Record<string, string>; reflectionNote: string; closingNote: string } } }).museum.visit;
      for (const id of REFLECTION_PROMPTS) expect(visit.prompts[id]).toMatch(/\?$/);
      expect(visit.reflectionNote).toBeTruthy();
      expect(visit.closingNote).toBeTruthy();
    }
    expect(en.museum.visit.reflectionNote).toContain('not a fact');
  });
});

describe('the real screen', () => {
  let screen: ReactTestRenderer;
  const PRIVATE_DESCRIPTION = 'Private collection description 8m';
  const text = () => {
    const parts: string[] = [];
    const walk = (node: ReactTestInstance | string) => {
      if (typeof node === 'string') parts.push(node);
      else {
        for (const value of Object.values(node.props)) if (typeof value === 'string') parts.push(value);
        node.children.forEach(walk);
      }
    };
    walk(screen.root);
    return parts.join(' | ');
  };
  const press = (testID: string) => act(() => screen.root.findAll((node) => node.props.testID === testID && typeof node.props.onPress === 'function')[0].props.onPress());

  beforeEach(async () => {
    await AsyncStorage.clear();
    useMyCollectionsStore.setState({ isLoaded: true, saved: {}, museums: {} });
    const store = useMyCollectionsStore.getState();
    const collection = store.create('guest', { name: 'Yurt things', description: PRIVATE_DESCRIPTION });
    for (const key of KEYS) store.add('guest', collection.id, 'culture_item', key.split(':')[1]);
    store.saveExhibition('guest', collection.id, exhibitionOf());
    act(() => {
      screen = create(createElement(MiniMuseumScreen, { collectionId: collection.id, onPressBack: () => undefined }));
    });
  });
  afterEach(() => act(() => screen.unmount()));

  it('walks the whole tour in order; the private description never appears; viewing records nothing', () => {
    const before = JSON.stringify(useMyCollectionsStore.getState().museums);
    press('museum-visit');
    const seen: string[] = [];
    for (let guard = 0; guard < 20; guard += 1) {
      const all = text();
      expect(all).not.toContain(PRIVATE_DESCRIPTION);
      if (all.includes('tour-closing') || screen.root.findAll((node) => node.props.testID === 'tour-closing').length > 0) break;
      const title = screen.root.findAll((node) => node.props.testID === 'tour-exhibit-title')[0];
      if (title) seen.push(String(title.props.children));
      if (screen.root.findAll((node) => node.props.testID === 'tour-exhibit-removed').length > 0) seen.push('(removed)');
      press('tour-next');
    }
    expect(seen).toEqual(['Боз үй', '(removed)', 'Түндүк', 'Шырдак']);
    expect(text()).toContain('museum.visit.closingNote');
    // The curator's caption was labelled as theirs, apart from OYNO's content.
    expect(JSON.stringify(useMyCollectionsStore.getState().museums)).toBe(before);
    const saved = ownerExhibition(useMyCollectionsStore.getState().museums, 'guest', Object.keys(useMyCollectionsStore.getState().museums.guest)[0]) as Exhibition;
    expect(saved.reflections).toEqual(exhibitionOf().reflections);
  });
});
