/**
 * Challenge sessions: each challenge (and free play) has its own history,
 * so Undo can never bring back motifs or a rule from somewhere else.
 * Model rules + the real screen.
 */
import { createElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import { CHALLENGES, playgroundReducer, startPlayground, type PlaygroundState } from './playgroundModel';
import { SymmetryPlaygroundScreen } from './SymmetryPlaygroundScreen';

jest.mock('react-i18next', () => ({ initReactI18next: { type: '3rdParty', init: () => undefined }, useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/services/ageExperience/useAgeExperience', () => ({ useAgeExperience: () => ({ experience: 'adult' }) }));
jest.mock('@/services/a11y/announce', () => ({ announce: () => undefined }));
jest.mock('@/components/ui', () => {
  const { createElement: h } = jest.requireActual('react');
  return {
    AnimatedPressable: (props: Record<string, unknown>) => h('AnimatedPressable', props, props.children),
    Button: (props: Record<string, unknown>) => h('Button', props, props.label),
    IconButton: (props: Record<string, unknown>) => h('IconButton', props),
    Toggle: (props: Record<string, unknown>) => h('Toggle', props),
  };
});

const twins = CHALLENGES.find((entry) => entry.id === 'twins')!;
const corners = CHALLENGES.find((entry) => entry.id === 'corners')!;
const which = CHALLENGES.find((entry) => entry.id === 'whichRule')!;
const run = (state: PlaygroundState, ...actions: Parameters<typeof playgroundReducer>[1][]) => actions.reduce(playgroundReducer, state);

describe('model', () => {
  it('entering a challenge starts an empty history in its rule; Undo cannot reach the free-play design', () => {
    let state = run(startPlayground(), { type: 'place', cell: { col: 0, row: 0 }, motifId: 'gul' }, { type: 'mode', mode: 'none' });
    state = run(state, { type: 'begin', challenge: corners });
    expect(state).toMatchObject({ history: [], lockedMode: 'fourWay', design: { mode: 'fourWay', pieces: [] } });
    expect(run(state, { type: 'undo' })).toBe(state);
    // The rule is fixed: no action changes it.
    expect(run(state, { type: 'mode', mode: 'mirror' })).toBe(state);
  });

  it('Undo and Reset work within the challenge, and Reset returns to its own start', () => {
    let state = run(startPlayground(), { type: 'begin', challenge: twins }, { type: 'place', cell: { col: 0, row: 1 }, motifId: 'muyuz' }, { type: 'place', cell: { col: 2, row: 3 }, motifId: 'gul' });
    state = run(state, { type: 'undo' });
    expect(state.design.pieces.map((piece) => piece.motifId)).toEqual(['muyuz']);
    state = run(state, { type: 'reset' });
    expect(state.design).toEqual({ mode: 'mirror', pieces: [] });
    state = run(state, { type: 'undo' });
    expect(state.design.pieces).toHaveLength(1); // Reset is undoable...
    state = run(state, { type: 'undo' }, { type: 'undo' }, { type: 'undo' });
    expect(state.design).toEqual({ mode: 'mirror', pieces: [] }); // ...but never past the challenge's start
    expect(state.history).toEqual([]);
  });

  it('switching challenges (and back to free play) never carries motifs or rules across', () => {
    let state = run(startPlayground(), { type: 'begin', challenge: corners }, { type: 'place', cell: { col: 4, row: 4 }, motifId: 'kochkorMuyuz' });
    state = run(state, { type: 'begin', challenge: which }, { type: 'mode', mode: 'fourWay' });
    expect(state.lockedMode).toBeNull(); // this one lets the player choose
    state = run(state, { type: 'undo' }, { type: 'undo' });
    expect(state.design).toEqual({ mode: 'none', pieces: [] });
    state = run(state, { type: 'begin', challenge: null });
    expect(state).toMatchObject({ history: [], lockedMode: null, design: { mode: 'mirror', pieces: [] } });
    // A long session is bounded but Reset still knows its start.
    for (let index = 0; index < 60; index += 1) state = run(state, { type: 'mode', mode: index % 2 ? 'mirror' : 'none' });
    expect(run(state, { type: 'reset' }).design).toEqual({ mode: 'mirror', pieces: [] });
  });
});

describe('the real screen', () => {
  let screen: ReactTestRenderer;
  const nodes = (testID: string): ReactTestInstance[] => screen.root.findAll((node) => node.props.testID === testID && (typeof node.props.onPress === 'function' || typeof node.props.onValueChange === 'function'));
  const press = (testID: string) => act(() => nodes(testID)[0].props.onPress());
  const pieces = () => [...new Set(screen.root.findAll((node) => typeof node.props.testID === 'string' && node.props.testID.startsWith('sym-piece-')).map((node) => node.props.testID as string))];
  const modeChecked = (mode: string) => nodes(`sym-mode-${mode}`)[0].props.accessibilityState;
  const undo = () => nodes('sym-undo')[0];

  beforeEach(() => {
    act(() => {
      screen = create(createElement(SymmetryPlaygroundScreen, { onPressBack: () => undefined }));
    });
  });
  afterEach(() => act(() => screen.unmount()));

  it('free play -> challenge: Undo is empty, the fixed rule stays fixed, earlier motifs never come back', () => {
    press('sym-cell-0-0');
    press('sym-mode-none');
    expect(pieces()).toEqual(['sym-piece-0-0']);
    press('sym-challenge-corners');
    expect(pieces()).toEqual([]);
    expect(undo().props.disabled).toBe(true);
    expect(modeChecked('fourWay')).toEqual({ checked: true, disabled: true });
    press('sym-cell-4-4');
    press('sym-undo');
    press('sym-undo');
    expect(pieces()).toEqual([]);
    expect(modeChecked('fourWay')).toEqual({ checked: true, disabled: true });
  });

  it('switching challenges, Reset within one, and returning to free play', () => {
    press('sym-challenge-twins');
    press('sym-cell-0-1');
    press('sym-challenge-whichRule');
    expect(pieces()).toEqual([]);
    expect(modeChecked('none')).toEqual({ checked: true, disabled: false });
    press('sym-mode-fourWay');
    press('sym-cell-3-3');
    press('sym-reset');
    expect(pieces()).toEqual([]);
    expect(modeChecked('none').checked).toBe(true); // Reset goes back to this challenge's start
    press('sym-undo');
    expect(pieces()).toEqual(['sym-piece-3-3']);
    press('sym-free-play');
    expect(pieces()).toEqual([]);
    expect(undo().props.disabled).toBe(true);
    expect(modeChecked('mirror')).toEqual({ checked: true, disabled: false });
  });
});
