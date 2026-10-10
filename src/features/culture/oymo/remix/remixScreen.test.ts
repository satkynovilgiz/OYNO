/** The previewed variation is exactly what the Creator receives; the original never changes. */
import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { takeCreatorHandoff } from '@/services/culture/oymoHandoff';
import type { MotifLayer } from '@/services/culture/oymoEditor';

import { OymoArtwork } from '../components/OymoArtwork';
import { setRemixSource, type RemixDesign } from './remixModel';
import { RemixStudioScreen } from './RemixStudioScreen';

jest.mock('react-i18next', () => ({ initReactI18next: { type: '3rdParty', init: () => undefined }, useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (path: string) => mockPush(path) } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/services/a11y/announce', () => ({ announce: () => undefined }));
jest.mock('@/features/games/records/useGameRecords', () => ({ useRecordsOwner: () => 'user-a' }));
jest.mock('@/components/ui', () => {
  const { createElement: h } = jest.requireActual('react');
  return {
    AnimatedPressable: (props: Record<string, unknown>) => h('AnimatedPressable', props, props.children),
    Button: (props: Record<string, unknown>) => h('Button', props, props.label),
    IconButton: (props: Record<string, unknown>) => h('IconButton', props),
  };
});

const layer = (id: number, x: number, y: number): MotifLayer => ({ id: `layer${id}`, motifId: 'muyuz', color: '#2F5233', point: { x, y }, rotation: 0, scale: 1, visible: true });
const original: RemixDesign = { layers: [layer(0, 40, 50), layer(1, 60, 140)], backgroundColor: '#EADCC0', symmetry: 'none' };
const snapshot = JSON.stringify(original);

let screen: ReactTestRenderer;
const byId = (testID: string) => screen.root.find((node) => node.props.testID === testID);
const artworkIn = (testID: string) => byId(testID).findByType(OymoArtwork).props as { layers: MotifLayer[]; backgroundColor: string; symmetryMode: string };
const press = (testID: string) => act(() => (byId(testID).props.onPress as () => void)());

beforeEach(() => {
  mockPush.mockClear();
  setRemixSource('user-a', original);
  act(() => {
    screen = create(createElement(RemixStudioScreen, { onPressBack: () => undefined }));
  });
});
afterEach(() => act(() => screen.unmount()));

it('no change -> nothing to open; the comparison starts identical', () => {
  expect(byId('remix-open').props.disabled).toBe(true);
  expect(artworkIn('remix-variation')).toEqual(artworkIn('remix-original'));
});

it('the opened copy equals the previewed variation, and the original stays as it was', () => {
  press('remix-palette-earth');
  press('remix-background-darkGreen');
  press('remix-symmetry-mirror');
  expect(byId('remix-change-palette')).toBeTruthy();
  expect(byId('remix-change-background')).toBeTruthy();
  expect(byId('remix-change-symmetry')).toBeTruthy();
  const preview = artworkIn('remix-variation');
  press('remix-open');
  const handoff = takeCreatorHandoff();
  expect(mockPush).toHaveBeenCalledWith('/culture/oymo/create');
  expect(handoff?.source).toBe('remix');
  expect({ layers: handoff?.state.layers, backgroundColor: handoff?.state.backgroundColor, symmetryMode: handoff?.symmetry }).toEqual({ layers: preview.layers, backgroundColor: preview.backgroundColor, symmetryMode: preview.symmetryMode });
  // The original side and the source design are untouched.
  expect(JSON.stringify(original)).toBe(snapshot);
  expect(artworkIn('remix-original').layers).toEqual(original.layers);
});

it('the current symmetry is shown but not offered as a change', () => {
  expect(byId('remix-symmetry-none').props.disabled).toBe(true);
  expect(byId('remix-symmetry-fourWay').props.disabled).toBe(false);
});
