import AsyncStorage from '@react-native-async-storage/async-storage';
import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import { addLayer, EMPTY_OYMO_STATE, rotateLayer, setBackgroundColor, type OymoEditorState } from '@/services/culture/oymoEditor';
import { takeCreatorHandoff } from '@/services/culture/oymoHandoff';
import { OYMO_RECIPES_KEY, recipeFor, useOymoRecipeStore } from '@/store/useOymoRecipeStore';

import { fingerprint, fitRecipe, finalState, MAX_RECIPE_BYTES, MAX_RECIPE_STEPS, normalizeRecipe, recipeBytes, recipeFromHistory, stageAsCopy, STEP_LABELS, type HistoryEntry } from './recipeModel';

jest.mock('@/services/supabase/client', () => ({ supabase: { auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }) } } }));

/** A history built with the Creator's OWN editor actions, as the Creator does. */
function build(): HistoryEntry[] {
  const history: HistoryEntry[] = [{ state: EMPTY_OYMO_STATE, symmetry: 'fourWay', label: 'start' }];
  const push = (state: OymoEditorState, label: HistoryEntry['label'], symmetry = history[history.length - 1].symmetry, motifId?: string) => history.push({ state, symmetry, label, ...(motifId ? { motifId } : {}) });
  const last = () => history[history.length - 1].state;
  push(addLayer(last(), { x: 60, y: 60 }, 'gul', '#2F5D3A'), 'place', undefined, 'gul');
  push(addLayer(last(), { x: 150, y: 90 }, 'muyuz', '#B9622F'), 'place', undefined, 'muyuz');
  push(rotateLayer(last(), last().layers[0].id), 'rotate');
  push(last(), 'symmetry', 'mirror');
  push(setBackgroundColor(last(), '#FBF3E3'), 'background');
  return history;
}

describe('replay reproduces the design', () => {
  it('every step is the complete stage; the last step IS the final design (layers, background, symmetry)', () => {
    const history = build();
    const recipe = recipeFromHistory(history, history.length - 1);
    expect(recipe.steps.map((step) => step.label)).toEqual(['start', 'place', 'place', 'rotate', 'symmetry', 'background']);
    recipe.steps.forEach((step, index) => {
      expect(step.state).toEqual({ layers: history[index].state.layers, backgroundColor: history[index].state.backgroundColor, symmetry: history[index].symmetry });
    });
    const last = history[history.length - 1];
    expect(finalState(recipe)).toEqual({ layers: last.state.layers, backgroundColor: '#FBF3E3', symmetry: 'mirror' });
    expect(recipe.steps[1].motifId).toBe('gul');
  });

  it('after Undo, the recipe ends at the current design (undone steps are not part of it)', () => {
    const history = build();
    const recipe = recipeFromHistory(history, 3);
    expect(recipe.steps).toHaveLength(4);
    expect(finalState(recipe)?.symmetry).toBe('fourWay');
  });

  it('labels exist for every step kind in KG/RU/EN', () => {
    for (const lang of [en, ru, kg]) for (const label of STEP_LABELS) expect((lang as unknown as { culture: { oymo: { recipe: { labels: Record<string, string> } } } }).culture.oymo.recipe.labels[label]).toBeTruthy();
  });
});

describe('intermediate stages as copies', () => {
  it('a stage opens as a deep, unlinked copy with a safe next id; changing it changes nothing else', () => {
    const history = build();
    const recipe = recipeFromHistory(history, history.length - 1);
    const before = JSON.stringify(recipe);
    const copy = stageAsCopy(recipe, 2)!;
    expect(copy.state.layers).toHaveLength(2);
    expect(copy.symmetry).toBe('fourWay');
    expect(copy.state).not.toHaveProperty('id');
    expect(copy.state.nextId).toBeGreaterThan(Math.max(...copy.state.layers.map((layer) => Number(layer.id.replace(/\D/g, '')))));
    copy.state.layers[0].point.x = 0;
    copy.state.layers.pop();
    expect(JSON.stringify(recipe)).toBe(before);
    expect(stageAsCopy(recipe, 99)).toBeNull();
  });
});

describe('limits', () => {
  const long = (count: number): HistoryEntry[] => {
    const history: HistoryEntry[] = [{ state: EMPTY_OYMO_STATE, symmetry: 'none', label: 'start' }];
    for (let index = 0; index < count; index += 1) history.push({ state: addLayer(history[history.length - 1].state, { x: 10 + (index % 28) * 10, y: 20 }, 'gul', '#2F5D3A'), symmetry: 'none', label: 'place', motifId: 'gul' });
    return history;
  };

  it('more than the step limit: the earliest steps are left out, the final design is kept, and it says how many', () => {
    const history = long(130);
    const fitted = fitRecipe(recipeFromHistory(history, history.length - 1));
    expect(fitted.steps.length).toBeLessThanOrEqual(MAX_RECIPE_STEPS);
    expect(fitted.trimmed).toBe(131 - fitted.steps.length);
    expect(finalState(fitted)?.layers).toEqual(history[history.length - 1].state.layers);
    expect(recipeBytes(fitted)).toBeLessThanOrEqual(MAX_RECIPE_BYTES);
  });

  it('the serialized size limit holds even when steps are big', () => {
    const history = long(90); // up to 90 layers per stage
    const fitted = fitRecipe(recipeFromHistory(history, history.length - 1));
    expect(recipeBytes(fitted)).toBeLessThanOrEqual(MAX_RECIPE_BYTES);
    expect(fitted.trimmed).toBeGreaterThan(0);
    expect(finalState(fitted)?.layers).toHaveLength(90);
  });
});

describe('saved recipes: older creations, owners, restarts', () => {
  const history = build();
  const recipe = recipeFromHistory(history, history.length - 1);
  const last = history[history.length - 1];
  const content = { layers: last.state.layers, backgroundColor: last.state.backgroundColor, symmetry: last.symmetry };

  beforeEach(async () => {
    await AsyncStorage.clear();
    useOymoRecipeStore.setState({ saved: {}, isLoaded: true });
  });

  it('an older creation (or one saved without a recipe) simply has none', () => {
    expect(recipeFor(useOymoRecipeStore.getState().saved, 'user-a', content)).toBeNull();
    expect(normalizeRecipe({ steps: [] })).toBeNull();
    expect(normalizeRecipe({ steps: [{ label: 'teleport', state: {} }] })).toBeNull();
  });

  it('a saved recipe belongs to its owner, survives a restart, and goes when the creation is deleted', async () => {
    useOymoRecipeStore.getState().saveRecipe('user-a', content, recipe);
    expect(recipeFor(useOymoRecipeStore.getState().saved, 'user-a', content)?.steps).toHaveLength(6);
    expect(recipeFor(useOymoRecipeStore.getState().saved, 'user-b', content)).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 0));
    useOymoRecipeStore.setState({ saved: {}, isLoaded: false });
    await useOymoRecipeStore.getState().load();
    expect(recipeFor(useOymoRecipeStore.getState().saved, 'user-a', content)).toEqual(recipe);
    // Matched by content: a different design has no recipe.
    expect(recipeFor(useOymoRecipeStore.getState().saved, 'user-a', { ...content, backgroundColor: '#000000' })).toBeNull();
    useOymoRecipeStore.getState().removeFor('user-a', content);
    expect(recipeFor(useOymoRecipeStore.getState().saved, 'user-a', content)).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(await AsyncStorage.getItem(OYMO_RECIPES_KEY)).not.toContain(fingerprint(content));
  });
});

describe('the Creator records the recipe (signed in) and replays a session', () => {
  let screen: ReactTestRenderer;
  const mockSave = jest.fn(async () => true);
  beforeAll(() => {
    jest.doMock('react-i18next', () => ({ initReactI18next: { type: '3rdParty', init: () => undefined }, useTranslation: () => ({ t: (key: string) => key }) }));
    jest.doMock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
    jest.doMock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }));
    jest.doMock('@tanstack/react-query', () => ({ ...jest.requireActual('@tanstack/react-query'), useQueryClient: () => ({ invalidateQueries: jest.fn() }) }));
    jest.doMock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
    jest.doMock('@/hooks/useIsTablet', () => ({ useIsTablet: () => false }));
    jest.doMock('@/services/analytics/analytics', () => ({ track: () => undefined }));
    jest.doMock('@/features/culture/components/LabAboutNote', () => ({ LabAboutNote: () => null }));
    jest.doMock('@/services/share/useShareCard', () => ({ useShareCard: () => ({ share: jest.fn(), shareHost: null }) }));
    jest.doMock('@/services/content/oymoCreationsService', () => ({ useOymoCreations: () => ({ data: [] }) }));
    jest.doMock('@/store/useAuthStore', () => ({ useAuthStore: (select: (state: { status: string }) => unknown) => select({ status: 'authenticated' }) }));
    jest.doMock('@/store/useProgressStore', () => ({ useProgressStore: { getState: () => ({ saveOymoCreation: mockSave, deleteOymoCreation: jest.fn() }) } }));
    jest.doMock('@/features/games/records/useGameRecords', () => ({ useRecordsOwner: () => 'user-a', currentRecordsOwner: () => 'user-a' }));
    jest.doMock('@/components/ui', () => {
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
  });

  beforeEach(async () => {
    await AsyncStorage.clear();
    useOymoRecipeStore.setState({ saved: {}, isLoaded: true });
    mockSave.mockClear();
  });

  it('edit (place, symmetry, background) -> save with the recipe -> the recipe replays to the saved design', async () => {
    const { OymoCreatorScreen } = jest.requireActual('../OymoCreatorScreen') as typeof import('../OymoCreatorScreen');
    const { SymmetryControl } = jest.requireActual('../components/SymmetryControl') as typeof import('../components/SymmetryControl');
    const { SaveModal } = jest.requireActual('../components/SaveModal') as typeof import('../components/SaveModal');
    act(() => {
      screen = create(createElement(OymoCreatorScreen, { onPressBack: () => undefined }));
    });
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
    const stored = recipeFor(useOymoRecipeStore.getState().saved, 'user-a', { layers: saved.layers, backgroundColor: saved.backgroundColor, symmetry: saved.symmetryMode })!;
    expect(stored.steps.map((step) => step.label)).toEqual(['start', 'place', 'symmetry', 'place']);
    expect(finalState(stored)).toEqual({ layers: saved.layers, backgroundColor: saved.backgroundColor, symmetry: 'mirror' });
    expect(recipeFor(useOymoRecipeStore.getState().saved, 'user-b', { layers: saved.layers, backgroundColor: saved.backgroundColor, symmetry: saved.symmetryMode })).toBeNull();

    // Undo reverts the symmetry change too (it is a step of its own).
    const undo = () => screen.root.findAll((node) => typeof node.props.accessibilityLabel === 'string' && /undo/i.test(node.props.accessibilityLabel) && node.props.onPress)[0];
    expect(undo()).toBeDefined();
    act(() => undo().props.onPress());
    expect(screen.root.findByType(SymmetryControl).props.mode).toBe('mirror');
    act(() => undo().props.onPress());
    expect(screen.root.findByType(SymmetryControl).props.mode).toBe('fourWay');
    act(() => screen.unmount());
  });

  it('saving WITHOUT the recipe stores none (recipes are optional)', async () => {
    const { OymoCreatorScreen } = jest.requireActual('../OymoCreatorScreen') as typeof import('../OymoCreatorScreen');
    const { SaveModal } = jest.requireActual('../components/SaveModal') as typeof import('../components/SaveModal');
    act(() => {
      screen = create(createElement(OymoCreatorScreen, { onPressBack: () => undefined }));
    });
    act(() => screen.root.findAll((node) => node.props.label === 'culture.oymo.placeAtCenter' && node.props.onPress)[0].props.onPress());
    await act(async () => {
      await screen.root.findByType(SaveModal).props.onSave('Plain');
    });
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(useOymoRecipeStore.getState().saved).toEqual({});
    expect(takeCreatorHandoff()).toBeNull();
    act(() => screen.unmount());
  });
});
