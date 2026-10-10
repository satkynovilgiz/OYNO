/** The player never shows another owner's session recipe or saved recipe, even on a direct route. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { create as createStore } from 'zustand';

import { EMPTY_OYMO_STATE } from '@/services/culture/oymoEditor';
import { LEGACY_RECIPES_KEY, useOymoRecipeStore } from '@/store/useOymoRecipeStore';

import { fingerprint, recipeFromHistory, sessionRecipe, setSessionRecipe } from './recipeModel';
import { RecipePlayerScreen } from './RecipePlayerScreen';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));
jest.mock('react-i18next', () => ({ initReactI18next: { type: '3rdParty', init: () => undefined }, useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/services/a11y/announce', () => ({ announce: () => undefined }));
jest.mock('@/services/motion/useReducedMotion', () => ({ useReducedMotion: () => true }));
// A stable list (like react-query's cached data), so effects re-run only when their real inputs change.
const mockCreations = [{ id: 'c1', name: 'n', layers: [], background_color: '#EADCC0', symmetry_mode: 'none', created_at: '', updated_at: '' }];
jest.mock('@/services/content/oymoCreationsService', () => ({ useOymoCreations: () => ({ data: mockCreations, isLoading: false }) }));
const mockOwner = createStore<{ owner: string }>(() => ({ owner: 'user-a' }));
jest.mock('@/features/games/records/useGameRecords', () => ({ useRecordsOwner: () => mockOwner((state) => state.owner) }));
jest.mock('@/components/ui', () => {
  const { createElement: h } = jest.requireActual('react');
  return {
    AnimatedPressable: (props: Record<string, unknown>) => h('AnimatedPressable', props, props.children),
    Button: (props: Record<string, unknown>) => h('Button', props, props.label),
    IconButton: (props: Record<string, unknown>) => h('IconButton', props),
  };
});

const recipe = recipeFromHistory([{ state: EMPTY_OYMO_STATE, symmetry: 'none', label: 'start' }, { state: EMPTY_OYMO_STATE, symmetry: 'mirror', label: 'symmetry' }], 1);
let screen: ReactTestRenderer;
const has = (testID: string) => screen.root.findAll((node) => node.props.testID === testID).length > 0;
const render = (creationId: string | null) =>
  act(() => {
    screen = create(createElement(RecipePlayerScreen, { creationId, onPressBack: () => undefined }));
  });

beforeEach(async () => {
  await AsyncStorage.clear();
  useOymoRecipeStore.setState({ saved: {}, isLoaded: true });
  mockOwner.setState({ owner: 'user-a' });
});
afterEach(() => act(() => screen.unmount()));

it("the session route shows the owner's own session", () => {
  setSessionRecipe('user-a', recipe);
  render(null);
  expect(has('recipe-stage')).toBe(true);
});

it('after switching account, a direct visit to the session route shows nothing - and the session is gone', () => {
  setSessionRecipe('user-a', recipe);
  mockOwner.setState({ owner: 'user-b' });
  render(null);
  expect(has('recipe-none')).toBe(true);
  expect(has('recipe-stage')).toBe(false);
  expect(sessionRecipe('user-a')).toBeNull();
});

it("another account's saved recipe for the same creation id is never shown", () => {
  useOymoRecipeStore.getState().saveRecipe('user-a', 'c1', recipe);
  mockOwner.setState({ owner: 'user-b' });
  render('c1');
  expect(has('recipe-none')).toBe(true);
  act(() => screen.unmount());
  mockOwner.setState({ owner: 'user-a' });
  render('c1');
  expect(has('recipe-stage')).toBe(true);
});

it('recipe storage that finishes loading after the creations still adopts an unambiguous v1 recipe', async () => {
  const print = fingerprint({ layers: [], backgroundColor: '#EADCC0', symmetry: 'none' });
  await AsyncStorage.setItem(LEGACY_RECIPES_KEY, JSON.stringify({ 'user-a': { [print]: { recipe, savedAt: 'x' } } }));
  useOymoRecipeStore.setState({ saved: {}, isLoaded: false });
  render('c1'); // creations are already there; storage is still loading
  expect(has('recipe-stage')).toBe(false);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(useOymoRecipeStore.getState().isLoaded).toBe(true);
  expect(has('recipe-stage')).toBe(true);
});
