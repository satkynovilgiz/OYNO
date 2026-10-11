/** Oymo Design Portfolio: ownership, ordering vs originals, missing designs, failed saves, export fields. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import { ownerPortfolio, ownerPortfolios, usePortfolioStore } from '@/store/usePortfolioStore';

import { MAX_ENTRIES, moveEntry, newPortfolio, normalizePortfolio, portfolioCardContent, resolveEntries, setCaption, toggleEntry, type DesignRow, type Portfolio } from './portfolioModel';
import { PortfolioScreen } from './PortfolioScreens';

jest.mock('react-i18next', () => ({ initReactI18next: { type: '3rdParty', init: () => undefined }, useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/services/a11y/announce', () => ({ announce: () => undefined }));
jest.mock('@/services/ageExperience/useAgeExperience', () => ({ useAgeExperience: () => ({ experience: 'adult' }) }));
jest.mock('@/store/useFeedbackStore', () => ({ useFeedbackStore: () => undefined }));
jest.mock('@/features/games/records/useGameRecords', () => {
  const owner = jest.requireActual('zustand').create(() => ({ owner: 'user-a' }));
  return { mockOwner: owner, useRecordsOwner: () => owner((state: { owner: string }) => state.owner) };
});
const mockOwner = (jest.requireMock('@/features/games/records/useGameRecords') as { mockOwner: { setState: (state: { owner: string }) => void } }).mockOwner;
const layer = (x: number) => ({ id: `layer${x}`, motifId: 'gul', color: '#2F5233', point: { x, y: 100 }, rotation: 0, scale: 1, visible: true });
const mockDesigns: DesignRow[] = [
  { id: 'd1', name: 'Felt corner', layers: [layer(60), layer(120)], background_color: '#EADCC0', symmetry_mode: 'mirror' },
  { id: 'd2', name: 'Blue night', layers: [layer(90)], background_color: '#FBF3E3', symmetry_mode: 'none' },
];
jest.mock('@/services/content/oymoCreationsService', () => ({ useOymoCreations: () => ({ data: mockDesigns, isError: false }) }));
const mockShare = jest.fn();
jest.mock('@/services/share/useShareCard', () => ({ useShareCard: () => ({ share: (content: unknown) => mockShare(content), shareHost: null, isSharing: false }) }));
jest.mock('@/components/ui', () => {
  const { createElement: h } = jest.requireActual('react');
  return {
    AnimatedPressable: (props: Record<string, unknown>) => h('AnimatedPressable', props, props.children),
    Button: (props: Record<string, unknown>) => h('Button', props, props.label),
    IconButton: (props: Record<string, unknown>) => h('IconButton', props),
    TextField: (props: Record<string, unknown>) => h('TextField', props),
    Toggle: (props: Record<string, unknown>) => h('Toggle', props),
    TextButton: (props: Record<string, unknown>) => h('TextButton', props),
  };
});

const withTwo = (): Portfolio => setCaption(toggleEntry(toggleEntry(newPortfolio('Synthetic portfolio'), 'd1'), 'd2'), 'd1', 'My first one');

describe('the model', () => {
  it('reordering changes only the references - never the saved designs', () => {
    const before = JSON.stringify(mockDesigns);
    const moved = moveEntry(withTwo(), 0, 1);
    expect(moved.entries.map((entry) => entry.creationId)).toEqual(['d2', 'd1']);
    resolveEntries(moved, mockDesigns);
    expect(JSON.stringify(mockDesigns)).toBe(before);
  });

  it('at most six, no duplicates; a caption leaves with its design', () => {
    let portfolio = newPortfolio('x');
    for (let index = 0; index < 9; index += 1) portfolio = toggleEntry(portfolio, `d${index}`);
    expect(portfolio.entries).toHaveLength(MAX_ENTRIES);
    expect(toggleEntry(withTwo(), 'd1').entries).toEqual([{ creationId: 'd2', caption: '' }]);
  });

  it('missing designs stay as labelled placeholders; nothing is dropped; loading is not "missing"', () => {
    const portfolio = toggleEntry(withTwo(), 'deleted-design');
    expect(resolveEntries(portfolio, mockDesigns).map((entry) => entry.status)).toEqual(['ok', 'ok', 'missing']);
    expect(resolveEntries(portfolio, null).map((entry) => entry.status)).toEqual(['loading', 'loading', 'loading']);
    expect(normalizePortfolio({ id: 'pf1', entries: [{ creationId: 'a' }, { creationId: 'a' }, { creationId: '../x' }] })?.entries).toEqual([{ creationId: 'a', caption: '' }]);
  });

  it('the export card carries only the allowed fields, and an independent copy of the design', () => {
    const portfolio = { ...withTwo(), intro: 'Private intro 7x' };
    const entry = resolveEntries(portfolio, mockDesigns)[0];
    if (entry.status !== 'ok') throw new Error('expected ok');
    const card = portfolioCardContent(portfolio, entry, true);
    expect(Object.keys(card).sort()).toEqual(['artwork', 'caption', 'designName', 'portfolioTitle']);
    expect(card).toMatchObject({ portfolioTitle: 'Synthetic portfolio', designName: 'Felt corner', caption: 'My first one' });
    expect(JSON.stringify(card)).not.toMatch(/Private intro|d1|user-a|recipe/);
    expect(portfolioCardContent(portfolio, entry, false).caption).toBeNull();
    card.artwork.layers[0].point.x = -1;
    expect(mockDesigns[0].layers[0].point.x).toBe(60);
  });
});

describe('storage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    usePortfolioStore.setState({ status: 'ready', saved: {} });
  });
  it('per owner; another account cannot read it; survives a restart', async () => {
    const portfolio = withTwo();
    expect(await usePortfolioStore.getState().save('user-a', portfolio)).toBe(true);
    expect(ownerPortfolios(usePortfolioStore.getState().saved, 'user-b')).toEqual([]);
    expect(ownerPortfolio(usePortfolioStore.getState().saved, 'user-b', portfolio.id)).toBeNull();
    usePortfolioStore.setState({ status: 'idle', saved: {} });
    await usePortfolioStore.getState().load();
    expect(ownerPortfolio(usePortfolioStore.getState().saved, 'user-a', portfolio.id)?.entries).toHaveLength(2);
  });
});

describe('the screen', () => {
  let screen: ReactTestRenderer;
  let portfolio: Portfolio;
  const all = (testID: string) => screen.root.findAll((node: ReactTestInstance) => node.props.testID === testID && typeof node.type === 'string');
  const has = (testID: string) => all(testID).length > 0;
  const press = (testID: string) => act(async () => { await all(testID)[0].props.onPress(); });
  beforeEach(async () => {
    await AsyncStorage.clear();
    mockOwner.setState({ owner: 'user-a' });
    mockShare.mockClear();
    portfolio = withTwo();
    usePortfolioStore.setState({ status: 'ready', saved: { 'user-a': [portfolio] } });
    act(() => {
      screen = create(createElement(PortfolioScreen, { portfolioId: portfolio.id, onPressBack: () => undefined }));
    });
  });
  afterEach(() => act(() => screen.unmount()));

  it('a failed save keeps the edits; Retry saves them', async () => {
    await press('portfolio-down-0');
    act(() => all('portfolio-caption-0')[0].props.onChangeText('Edited caption'));
    const real = AsyncStorage.setItem;
    AsyncStorage.setItem = () => Promise.reject(new Error('disk full'));
    await press('portfolio-save');
    AsyncStorage.setItem = real;
    expect(has('portfolio-save-failed')).toBe(true);
    expect(all('portfolio-caption-0')[0].props.value).toBe('Edited caption');
    expect(ownerPortfolio(usePortfolioStore.getState().saved, 'user-a', portfolio.id)?.entries[0].creationId).toBe('d1'); // nothing stored yet
    await press('portfolio-save');
    const saved = ownerPortfolio(usePortfolioStore.getState().saved, 'user-a', portfolio.id)!;
    expect(saved.entries.map((entry) => [entry.creationId, entry.caption])).toEqual([['d2', 'Edited caption'], ['d1', 'My first one']]);
  });

  it('export sends exactly the previewed card', async () => {
    await press('portfolio-mode-grid');
    const previewed = all('portfolio-export-preview')[0].findAll((node) => typeof node.props.card === 'object')[0].props.card;
    await press('portfolio-export-button');
    const shared = mockShare.mock.calls[0][0] as { artwork: { props: { card: unknown } } };
    expect(shared.artwork.props.card).toEqual(previewed);
    expect(JSON.stringify(shared)).not.toMatch(/user-a|recipe/);
  });

  it("another account sees nothing of this portfolio", () => {
    expect(has('portfolio-screen')).toBe(true);
    act(() => mockOwner.setState({ owner: 'user-b' }));
    expect(has('portfolio-screen')).toBe(false);
    expect(JSON.stringify(screen.toJSON())).not.toContain('My first one');
  });
});
