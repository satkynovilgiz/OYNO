import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import type { CultureItemRow } from '@/services/content/types';

import { choices, choose, FREE_FIELDS, FREE_LABEL_KEY, freeCompareRoute, freeCompareRows, pairConnections, swap } from './freeCompare';
import { FreeCompareScreen } from './FreeCompareScreen';

jest.mock('react-i18next', () => ({ initReactI18next: { type: '3rdParty', init: () => undefined }, useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }) }));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), setParams: jest.fn() } }));
const mockRouter = (jest.requireMock('expo-router') as { router: { push: jest.Mock; setParams: jest.Mock } }).router;
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/services/ageExperience/useAgeExperience', () => ({ useAgeExperience: () => ({ experience: 'adult' }) }));
jest.mock('@/components/content/SourcesAndNotes', () => ({ SourcesAndNotes: () => null }));
jest.mock('@/components/content/KyrgyzOnlyNote', () => ({ KyrgyzOnlyNote: () => null }));
jest.mock('@/components/offline/OfflineUnavailable', () => {
  const { createElement: h } = jest.requireActual('react');
  return { OfflineUnavailable: () => h('OfflineUnavailable', { testID: 'offline' }) };
});
jest.mock('@/components/ui', () => {
  const { createElement: h } = jest.requireActual('react');
  return {
    AnimatedPressable: (props: Record<string, unknown>) => h('AnimatedPressable', props, props.children),
    Button: (props: Record<string, unknown>) => h('Button', props, props.label),
    IconButton: (props: Record<string, unknown>) => h('IconButton', props),
    MediaImage: () => null,
  };
});
const mockQuery: { data: CultureItemRow[] | undefined; fetchStatus: string; isLoading: boolean; refetch: () => void } = { data: undefined, fetchStatus: 'idle', isLoading: false, refetch: () => undefined };
jest.mock('@/services/content/cultureItemsService', () => ({ useAllCultureItems: () => mockQuery }));

const row = (id: string, fields: Partial<CultureItemRow>): CultureItemRow => ({ id, title: `Title ${id}`, alt_names: null, category_id: 'boz-uy', ...Object.fromEntries(FREE_FIELDS.map((field) => [field, null])), ...fields }) as CultureItemRow;
const TUNDUK = row('boz-uy-tunduk', { origin: 'Origin text A', cultural_meaning: 'Meaning A' });
const KARKAS = row('boz-uy-karkas', { origin: 'Origin text B', traditional_method: 'Method B' });
const EER = row('horse-eer', { origin: 'Origin E' });

describe('fields: only the model, only authored text', () => {
  it('a field one side lacks is "Not provided" (null); fields neither has are left out and listed', () => {
    const { rows, neither } = freeCompareRows(TUNDUK, KARKAS);
    expect(rows).toEqual([
      { field: 'origin', left: 'Origin text A', right: 'Origin text B' },
      { field: 'cultural_meaning', left: 'Meaning A', right: null },
      { field: 'traditional_method', left: null, right: 'Method B' },
    ]);
    expect(neither).toEqual(FREE_FIELDS.filter((field) => !['origin', 'cultural_meaning', 'traditional_method'].includes(field)));
    // Whitespace-only text is not "provided".
    expect(freeCompareRows(row('a', { origin: '   ' }), row('b', {})).rows).toEqual([]);
  });

  it('every compared field is a real content-model field with an existing label in KG/RU/EN', () => {
    for (const lang of [en, ru, kg]) {
      const item = (lang as unknown as { culture: { item: Record<string, string> } }).culture.item;
      for (const field of FREE_FIELDS) expect(item[FREE_LABEL_KEY[field].split('.').pop()!]).toBeTruthy();
      expect((lang as unknown as { compare: { free: { notProvided: string } } }).compare.free.notProvided).toBeTruthy();
    }
  });
});

describe('connections only when the data has them', () => {
  it('the frame/tündük pair shows its curated link (read from the left item); an unlinked pair shows none', () => {
    expect(pairConnections('boz-uy-karkas', 'boz-uy-tunduk').map((entry) => [entry.connection.id, entry.labelKey])).toEqual([['tunduk-part-of-karkas', 'includes']]);
    expect(pairConnections('boz-uy-tunduk', 'boz-uy-karkas').map((entry) => entry.labelKey)).toEqual(['part_of']);
    expect(pairConnections('boz-uy-tunduk', 'horse-eer')).toEqual([]);
    // A one-way relation reads with its own label from the other side (no invented reverse).
    expect(pairConnections('boz-uy-kiyiz-jabuu', 'boz-uy-karkas').map((entry) => entry.labelKey)).toEqual(['learn_next']);
  });
});

describe('selection', () => {
  it('choose fills or replaces one side; choosing the other side item swaps; swap and route', () => {
    let pair = choose({ left: null, right: null }, 'left', 'a');
    pair = choose(pair, 'right', 'b');
    expect(pair).toEqual({ left: 'a', right: 'b' });
    expect(choose(pair, 'right', 'c')).toEqual({ left: 'a', right: 'c' }); // replace
    expect(choose(pair, 'left', 'b')).toEqual({ left: 'b', right: 'a' }); // never the same item twice
    expect(swap(pair)).toEqual({ left: 'b', right: 'a' });
    expect(freeCompareRoute(pair)).toBe('/culture/compare/pick?left=a&right=b');
    expect(freeCompareRoute({ left: 'a', right: null })).toBe('/culture/compare/pick?left=a');
    expect(choices([TUNDUK, KARKAS, EER], 'karkas', null).map((item) => item.id)).toEqual(['boz-uy-karkas']);
  });
});

describe('the screen', () => {
  let screen: ReactTestRenderer;
  const render = (pair: { left: string | null; right: string | null }) =>
    act(() => {
      screen = create(createElement(FreeCompareScreen, { pair, onPressBack: () => undefined }));
    });
  const has = (testID: string) => screen.root.findAll((node) => node.props.testID === testID).length > 0;
  const text = () => screen.root.findAll((node) => typeof node.children[0] === 'string').map((node) => node.children.join('')).join(' | ');

  beforeEach(() => {
    mockRouter.setParams.mockClear();
    mockQuery.data = [TUNDUK, KARKAS, EER];
    mockQuery.fetchStatus = 'idle';
  });
  afterEach(() => act(() => screen.unmount()));

  it('shows both sides, "Not provided" where an article says nothing, and the curated link', () => {
    render({ left: 'boz-uy-tunduk', right: 'boz-uy-karkas' });
    expect(has('fc-comparison')).toBe(true);
    expect(text()).toContain('compare.free.notProvided');
    expect(has('fc-link-tunduk-part-of-karkas')).toBe(true);
    expect(has('fc-row-history')).toBe(false); // neither side has it
  });

  it('a missing item says so (no comparison); replacing a side updates the route', () => {
    render({ left: 'boz-uy-tunduk', right: 'removed-item' });
    expect(has('fc-missing-right')).toBe(true);
    expect(has('fc-comparison')).toBe(false);
    act(() => screen.root.findAll((node) => node.props.testID === 'fc-choose-right' && node.props.onPress)[0].props.onPress());
    act(() => screen.root.findAll((node) => node.props.testID === 'fc-pick-horse-eer' && node.props.onPress)[0].props.onPress());
    expect(mockRouter.setParams).toHaveBeenLastCalledWith({ left: 'boz-uy-tunduk', right: 'horse-eer' });
  });

  it('offline with nothing cached: the standard offline screen; cached content still compares offline', () => {
    mockQuery.data = undefined;
    mockQuery.fetchStatus = 'paused';
    render({ left: 'boz-uy-tunduk', right: 'boz-uy-karkas' });
    expect(has('offline')).toBe(true);
    act(() => screen.unmount());
    mockQuery.data = [TUNDUK, KARKAS];
    mockQuery.fetchStatus = 'paused'; // offline, but cached
    render({ left: 'boz-uy-tunduk', right: 'boz-uy-karkas' });
    expect(has('fc-comparison')).toBe(true);
  });
});
