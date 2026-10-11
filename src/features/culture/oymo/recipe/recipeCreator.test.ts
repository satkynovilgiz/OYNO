/**
 * The Oymo Creator records a Pattern Recipe when saving (signed in) and
 * replays a session. Kept in its own file with HOISTED module mocks and
 * static imports: the Creator's module graph loads with the file, not
 * inside a test's time budget (loading it in a test via requireActual
 * after doMock cost ~1.4 s cold and could hit the 5 s timeout on CI).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import type { OymoEditorState } from '@/services/culture/oymoEditor';
import { takeCreatorHandoff } from '@/services/culture/oymoHandoff';
import { recipeFor, useOymoRecipeStore } from '@/store/useOymoRecipeStore';

import { SaveModal } from '../components/SaveModal';
import { SymmetryControl } from '../components/SymmetryControl';
import { OymoCreatorScreen } from '../OymoCreatorScreen';
import { finalState } from './recipeModel';

jest.mock('@/services/supabase/client', () => ({ supabase: { auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }) } } }));
// The fake server: saving appends a row with a fresh id (the RPC itself returns no id).
const mockRows: { id: string; name: string; layers: unknown; background_color: string; symmetry_mode: string; created_at: string; updated_at: string }[] = [];
const mockSave = jest.fn(async (input: { name: string; layers: unknown; backgroundColor: string; symmetryMode: string }) => {
  mockRows.unshift({ id: `row-${mockRows.length + 1}`, name: input.name, layers: JSON.parse(JSON.stringify(input.layers)), background_color: input.backgroundColor, symmetry_mode: input.symmetryMode, created_at: '', updated_at: '' });
  return true;
});

jest.mock('react-i18next', () => ({ initReactI18next: { type: '3rdParty', init: () => undefined }, useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }));
jest.mock('@tanstack/react-query', () => ({ ...jest.requireActual('@tanstack/react-query'), useQueryClient: () => ({ invalidateQueries: jest.fn(), getQueryData: () => [...mockRows], fetchQuery: async () => [...mockRows] }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/hooks/useIsTablet', () => ({ useIsTablet: () => false }));
jest.mock('@/services/analytics/analytics', () => ({ track: () => undefined }));
jest.mock('@/features/culture/components/LabAboutNote', () => ({ LabAboutNote: () => null }));
jest.mock('@/services/share/useShareCard', () => ({ useShareCard: () => ({ share: jest.fn(), shareHost: null }) }));
jest.mock('@/services/content/oymoCreationsService', () => ({ OYMO_CREATIONS_QUERY_KEY: ['oymo_creations'], fetchOymoCreations: async () => [...mockRows], useOymoCreations: () => ({ data: [...mockRows] }) }));
jest.mock('@/store/useAuthStore', () => ({ useAuthStore: (select: (state: { status: string }) => unknown) => select({ status: 'authenticated' }) }));
jest.mock('@/store/useProgressStore', () => ({ useProgressStore: { getState: () => ({ saveOymoCreation: mockSave, deleteOymoCreation: jest.fn() }) } }));
jest.mock('@/features/games/records/useGameRecords', () => ({ useRecordsOwner: () => 'user-a', currentRecordsOwner: () => 'user-a' }));
jest.mock('@/components/ui', () => {
  const { createElement: h } = jest.requireActual('react');
  return {
    AnimatedPressable: (props: Record<string, unknown>) => h('AnimatedPressable', props, props.children),
    Button: (props: Record<string, unknown>) => h('Button', props, props.label),
    IconButton: (props: Record<string, unknown>) => h('IconButton', props),
    ConfirmationModal: () => null,
    TextField: (props: Record<string, unknown>) => h('TextField', props),
    Toggle: (props: Record<string, unknown>) => h('Toggle', props),
  };
});

describe('the Creator records the recipe (signed in) and replays a session', () => {
  let screen: ReactTestRenderer;
  let mounted = false;
  beforeEach(async () => {
    await AsyncStorage.clear();
    useOymoRecipeStore.setState({ saved: {}, isLoaded: true });
    mockSave.mockClear();
    mockRows.length = 0;
  });
  // Unmounted even when an assertion fails, so nothing of one test runs on into the next.
  afterEach(() => {
    if (mounted) act(() => screen.unmount());
    mounted = false;
  });

  it('edit (place, symmetry, background) -> save with the recipe -> the recipe replays to the saved design', async () => {
    act(() => {
      screen = create(createElement(OymoCreatorScreen, { onPressBack: () => undefined }));
    });
    mounted = true;
    const buttonByLabel = (label: string) => screen.root.findAll((node) => node.props.label === label && node.props.onPress)[0];
    act(() => buttonByLabel('culture.oymo.placeAtCenter').props.onPress());
    const tab = (label: string) => act(() => screen.root.findAll((node) => node.props.accessibilityLabel === label && node.props.onPress)[0].props.onPress());
    tab('culture.oymo.symmetrySection');
    act(() => screen.root.findByType(SymmetryControl).props.onChangeMode('mirror'));
    act(() => buttonByLabel('culture.oymo.placeAtCenter').props.onPress());
    const modal = () => screen.root.findByType(SaveModal);
    expect(modal().props.recipe).toMatchObject({ include: false, steps: 4, kept: 4 });
    act(() => modal().props.recipe.onChange(true));
    await act(async () => {
      await modal().props.onSave('My pattern');
    });
    expect(mockSave).toHaveBeenCalledTimes(1);
    const saved = (mockSave.mock.calls[0] as unknown as [{ layers: OymoEditorState['layers']; backgroundColor: string; symmetryMode: 'mirror' }])[0];
    const stored = recipeFor(useOymoRecipeStore.getState().saved, 'user-a', 'row-1')!;
    expect(stored.steps.map((step) => step.label)).toEqual(['start', 'place', 'symmetry', 'place']);
    expect(finalState(stored)).toEqual({ layers: saved.layers, backgroundColor: saved.backgroundColor, symmetry: 'mirror' });
    expect(recipeFor(useOymoRecipeStore.getState().saved, 'user-b', 'row-1')).toBeNull();

    // The SAME design saved again WITHOUT the recipe: that new creation gets none (no inheriting by content).
    act(() => modal().props.recipe.onChange(false));
    await act(async () => {
      await modal().props.onSave('Same again');
    });
    expect(mockRows.map((entry) => entry.id)).toEqual(['row-2', 'row-1']);
    expect(recipeFor(useOymoRecipeStore.getState().saved, 'user-a', 'row-2')).toBeNull();
    expect(recipeFor(useOymoRecipeStore.getState().saved, 'user-a', 'row-1')).not.toBeNull();

    // Undo reverts the symmetry change too (it is a step of its own).
    const undo = () => screen.root.findAll((node) => typeof node.props.accessibilityLabel === 'string' && /undo/i.test(node.props.accessibilityLabel) && node.props.onPress)[0];
    expect(undo()).toBeDefined();
    act(() => undo().props.onPress());
    expect(screen.root.findByType(SymmetryControl).props.mode).toBe('mirror');
    act(() => undo().props.onPress());
    expect(screen.root.findByType(SymmetryControl).props.mode).toBe('fourWay');
  });

  it('saving WITHOUT the recipe stores none (recipes are optional)', async () => {
    act(() => {
      screen = create(createElement(OymoCreatorScreen, { onPressBack: () => undefined }));
    });
    mounted = true;
    act(() => screen.root.findAll((node) => node.props.label === 'culture.oymo.placeAtCenter' && node.props.onPress)[0].props.onPress());
    await act(async () => {
      await screen.root.findByType(SaveModal).props.onSave('Plain');
    });
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(useOymoRecipeStore.getState().saved).toEqual({});
    expect(takeCreatorHandoff()).toBeNull();
  });
});
