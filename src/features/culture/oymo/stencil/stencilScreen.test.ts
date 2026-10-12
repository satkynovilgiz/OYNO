/**
 * Stencil Studio screen: the PDF prints exactly the page the preview draws,
 * and a failed export keeps every setting and offers Retry. Print/Share are
 * replaced at the shared PDF service boundary (no native rendering here).
 */
import { createElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import { setStencilSource, stencilHtml, type StencilPage } from './stencilModel';
import { StencilPreview, StencilStudioScreen } from './StencilStudioScreen';

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
jest.mock('@/services/a11y/announce', () => ({ announce: () => undefined }));
jest.mock('@/store/useAuthStore', () => ({ useAuthStore: Object.assign((select: (s: unknown) => unknown) => select({ status: 'guest', user: null }), { getState: () => ({ status: 'guest', user: null }) }) }));
const mockExport = { calls: [] as { html: string; fileName: string; size: { width: number; height: number } }[], fail: true };
jest.mock('@/features/journal/book/memoryBookService', () => {
  class ExportCancelledError extends Error {}
  class SharingUnavailableError extends Error {}
  return {
    ExportCancelledError,
    SharingUnavailableError,
    pdfExportSupported: () => true,
    printAndSharePdf: async (html: string, fileName: string, size: { width: number; height: number }) => {
      mockExport.calls.push({ html, fileName, size });
      if (mockExport.fail) throw new Error('print failed');
    },
  };
});

const layer = (id: string, x: number) => ({ id, motifId: 'tortKulak', color: '#C0392B', point: { x, y: 120 }, rotation: 30, scale: 1.2, visible: true });
const original = { layers: [layer('a', 80), layer('b', 150)], symmetry: 'fourWay' as const, name: 'Mine' };
const frozen = JSON.stringify(original);

let screen: ReactTestRenderer;
const find = (testID: string): ReactTestInstance | undefined => screen.root.findAll((node) => node.props.testID === testID && (node.props.onPress || typeof node.type === 'string'))[0];
const press = async (testID: string) => act(async () => find(testID)!.props.onPress());
const shownPage = (): StencilPage => screen.root.findByType(StencilPreview).props.page;

beforeEach(() => {
  mockExport.calls = [];
  mockExport.fail = true;
  setStencilSource('guest', original);
  act(() => {
    screen = create(createElement(StencilStudioScreen, { onPressBack: () => undefined }));
  });
});
afterEach(() => act(() => screen.unmount()));

it('a failed export keeps every setting; Retry prints the same page', async () => {
  await press('stencil-orientation-landscape');
  await press('stencil-thickness-thick');
  await press('stencil-guides');
  await press('stencil-label-name');
  const before = shownPage();
  await press('stencil-export');
  expect(find('stencil-export-failed')).toBeDefined();
  expect(find('stencil-export')!.props.label).toBe('stencil.retry');
  expect(shownPage()).toEqual(before); // settings unchanged
  mockExport.fail = false;
  await press('stencil-export');
  expect(find('stencil-exported')).toBeDefined();
  expect(mockExport.calls).toHaveLength(2);
  // Both attempts print exactly the page on screen.
  for (const call of mockExport.calls) {
    expect(call.html).toBe(stencilHtml(before, 'landscape'));
    expect(call.size).toEqual({ width: 842, height: 595 });
    expect(call.fileName).toMatch(/^OYNO-Stencil-\d{4}-\d{2}-\d{2}\.pdf$/);
  }
  expect(JSON.stringify(original)).toBe(frozen); // the design itself is untouched
});
