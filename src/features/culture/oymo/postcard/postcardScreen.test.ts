/**
 * The postcard screen's behaviour: it starts from a copy, never writes the
 * saved pattern, exports exactly the composition on screen, and a failed
 * export (preview kept open by useShareCard) leaves the composition as it was.
 */
import { createElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import type { ShareCardContent } from '@/components/share/ShareCard';

import { cardSize } from './postcardModel';
import { PostcardScreen } from './PostcardScreen';
import { PostcardView } from './PostcardView';

jest.mock('react-i18next', () => ({ initReactI18next: { type: '3rdParty', init: () => undefined }, useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('@/components/ui', () => {
  const { createElement: h } = jest.requireActual('react');
  return {
    AnimatedPressable: (props: Record<string, unknown>) => h('AnimatedPressable', props, props.children),
    Button: (props: Record<string, unknown>) => h('Button', props, props.label),
    IconButton: (props: Record<string, unknown>) => h('IconButton', props),
  };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/services/ageExperience/useAgeExperience', () => ({ useAgeExperience: () => ({ experience: 'adult' }) }));
const layer = (id: string, x: number) => ({ id, motifId: 'kochkorMuyuz', color: '#2F5D3A', point: { x, y: 150 }, rotation: 0, scale: 1, visible: true });
const mockSaved = Object.freeze({
  id: 'saved-1',
  name: 'My oymo',
  layers: Object.freeze([Object.freeze({ ...layer('a', 150), point: Object.freeze({ x: 150, y: 150 }) }), Object.freeze({ ...layer('b', 60), point: Object.freeze({ x: 60, y: 150 }) })]),
  background_color: '#EADCC0',
  symmetry_mode: 'fourWay',
  created_at: '',
  updated_at: '',
});
jest.mock('@/services/content/oymoCreationsService', () => ({ useOymoCreations: () => ({ data: [mockSaved], isLoading: false }) }));
// Every way a saved pattern can be written - none may be called.
const mockWrites = { saveOymoCreation: jest.fn(), deleteOymoCreation: jest.fn() };
jest.mock('@/store/useProgressStore', () => ({ useProgressStore: { getState: () => mockWrites } }));
const mockShare: { calls: ShareCardContent[] } = { calls: [] };
jest.mock('@/services/share/useShareCard', () => ({ useShareCard: () => ({ share: async (content: ShareCardContent) => void mockShare.calls.push(content), shareHost: null, isSharing: false }) }));

let screen: ReactTestRenderer;
const find = (testID: string): ReactTestInstance => screen.root.findAll((node) => node.props.testID === testID && (node.props.onPress || node.props.onChangeText))[0];
const press = (testID: string) => act(() => find(testID).props.onPress());
const type = (text: string) => act(() => find('postcard-greeting-input').props.onChangeText(text));
/** The composition the on-screen preview is drawing. */
const shown = () => screen.root.findAll((node) => node.props.testID === 'postcard-preview')[0].findByType(PostcardView).props.composition;
const previewTree = () => JSON.stringify(shown());

beforeEach(() => {
  mockShare.calls = [];
  act(() => {
    screen = create(createElement(PostcardScreen, { patternId: 'saved-1', onPressBack: () => undefined }));
  });
});
afterEach(() => act(() => screen.unmount()));

it('exports exactly the composition on screen, in both formats', () => {
  type('Жаңы жылыңыз менен!');
  press('postcard-layout-banner');
  press('postcard-size-small');
  press('postcard-background-gold');
  for (const format of ['square', 'portrait'] as const) {
    press(`postcard-format-${format}`);
    press('postcard-export');
    const content = mockShare.calls[mockShare.calls.length - 1];
    expect(content).toMatchObject({ variant: 'postcard', cardSize: cardSize(format), imageSource: null });
    // The exported artwork is the same component with the very composition on screen.
    const artwork = content.artwork as { type: unknown; props: { composition: unknown } };
    expect(artwork.type).toBe(PostcardView);
    expect(artwork.props.composition).toEqual(shown());
    expect(shown()).toMatchObject({ format, layout: 'banner', size: 'small', background: 'gold', greeting: 'Жаңы жылыңыз менен!' });
  }
});

it('a failed export (the share sheet stays open) leaves the composition exactly as it was', () => {
  type('Happy holidays!');
  press('postcard-format-square');
  press('postcard-layout-border');
  const before = previewTree();
  press('postcard-export');
  // useShareCard reports the failure and keeps its preview; nothing here is reset.
  expect(find('postcard-greeting-input').props.value).toBe('Happy holidays!');
  expect(previewTree()).toBe(before);
  // Retrying exports the same thing again.
  press('postcard-export');
  const composition = (index: number) => (mockShare.calls[index].artwork as { props: { composition: unknown } }).props.composition;
  expect(composition(1)).toEqual(composition(0));
});

it('the saved pattern is never changed or written', () => {
  type('Edited greeting');
  for (const id of ['postcard-format-portrait', 'postcard-layout-classic', 'postcard-size-large', 'postcard-position-top', 'postcard-background-forest', 'postcard-export']) press(id);
  expect(mockWrites.saveOymoCreation).not.toHaveBeenCalled();
  expect(mockWrites.deleteOymoCreation).not.toHaveBeenCalled();
  expect(mockSaved.layers.map((item) => item.point.x)).toEqual([150, 60]);
  expect(mockSaved.background_color).toBe('#EADCC0');
});

it('the greeting limit holds while typing', () => {
  type('Ж'.repeat(120));
  expect([...find('postcard-greeting-input').props.value].length).toBe(80);
});
