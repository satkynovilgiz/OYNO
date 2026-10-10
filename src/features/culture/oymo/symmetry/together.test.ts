/** Remember the Pattern, two players: phases, privacy, deep copies, validation, assistance, matching, solvability. */
import { createElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import { cellKey, type Design } from './playgroundModel';
import { compare } from './rememberModel';
import { RememberTogetherScreen } from './RememberTogetherScreen';
import { ALL_CELLS, MAX_PIECES, rebuildMotifs, START_TOGETHER, togetherReducer, TOGETHER_MOTIFS, toReference, validateDesign, type TogetherAction, type TogetherState } from './togetherModel';

jest.mock('react-i18next', () => ({ initReactI18next: { type: '3rdParty', init: () => undefined }, useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/services/a11y/announce', () => ({ announce: () => undefined }));
jest.mock('@/services/ageExperience/useAgeExperience', () => ({ useAgeExperience: () => ({ experience: 'adult' }) }));
jest.mock('@/components/ui', () => {
  const { createElement: h } = jest.requireActual('react');
  return {
    AnimatedPressable: (props: Record<string, unknown>) => h('AnimatedPressable', props, props.children),
    Button: (props: Record<string, unknown>) => h('Button', props, props.label),
    IconButton: (props: Record<string, unknown>) => h('IconButton', props),
    TextField: (props: Record<string, unknown>) => h('TextField', props),
  };
});

const run = (state: TogetherState, ...actions: TogetherAction[]) => actions.reduce(togetherReducer, state);
const place = (col: number, row: number, motifId = 'gul'): TogetherAction => ({ type: 'author', action: { type: 'place', cell: { col, row }, motifId } });
const play = (action: Extract<TogetherAction, { type: 'play' }>['action']): TogetherAction => ({ type: 'play', action });
const authored = (...placements: TogetherAction[]) => run(START_TOGETHER, { type: 'begin' }, ...placements);
const THREE = [place(0, 0, 'muyuz'), place(2, 2), place(4, 1, 'bulak')];

describe('phases', () => {
  it('setup -> authoring -> pass -> (Ready) -> viewing -> building -> done -> swap', () => {
    let state = run(START_TOGETHER, { type: 'name', role: 'a', name: 'Aida<script>' }, { type: 'begin' });
    expect(state.phase).toBe('authoring');
    expect(state.players.a).toBe('Aidascript');
    state = run(state, ...THREE, { type: 'pass' });
    expect(state.phase).toBe('pass');
    // Nothing but Ready leaves the privacy screen.
    expect(run(state, play({ type: 'hide' }), { type: 'swap' }, place(1, 1))).toBe(state);
    state = run(state, { type: 'ready' });
    expect(state.phase === 'attempt' && state.attempt.phase).toBe('viewing');
    state = run(state, play({ type: 'hide' }));
    for (const mark of (state as Extract<TogetherState, { phase: 'attempt' }>).reference.marks) state = run(state, play({ type: 'edit', action: { type: 'place', cell: mark.cell, motifId: mark.motifId } }));
    state = run(state, play({ type: 'check' }));
    expect(state.phase === 'attempt' && state.attempt.phase).toBe('done');
    state = run(state, { type: 'swap' });
    expect(state).toMatchObject({ phase: 'authoring', author: 'b', problems: [] });
    expect(state.phase === 'authoring' && state.editor.design.pieces).toEqual([]);
    expect('reference' in state).toBe(false);
  });

  it('swap only after a finished attempt; retry returns to the privacy screen with a fresh attempt', () => {
    let state = run(authored(...THREE), { type: 'pass' }, { type: 'ready' }, play({ type: 'hide' }), play({ type: 'showAgain' }));
    expect(state.phase === 'attempt' && state.attempt.assisted).toBe(true);
    expect(run(state, { type: 'swap' })).toBe(state);
    state = run(state, { type: 'retry' });
    expect(state.phase).toBe('pass');
    state = run(state, { type: 'ready' });
    expect(state.phase === 'attempt' && state.attempt).toMatchObject({ assisted: false, views: 1, checks: 0, phase: 'viewing' });
    expect(run(state, { type: 'newGame' })).toMatchObject({ phase: 'setup', players: { a: '', b: '' } });
  });
});

describe('validation', () => {
  it('3-7 pieces of supported motifs, on the grid, one per cell', () => {
    const design = (pieces: [number, number, string][]): Design => ({ mode: 'none', pieces: pieces.map(([col, row, motifId], index) => ({ id: `p${index}`, motifId, cell: { col, row } })) });
    expect(validateDesign(design([[0, 0, 'gul'], [1, 1, 'gul']]))).toEqual(['tooFew']);
    expect(validateDesign(design([[0, 0, 'gul'], [1, 1, 'gul'], [2, 2, 'gul']]))).toEqual([]);
    expect(validateDesign(design(Array.from({ length: 8 }, (_, index) => [index % 5, Math.floor(index / 5), 'gul'] as [number, number, string])))).toEqual(['tooMany']);
    expect(validateDesign(design([[0, 0, 'invented'], [1, 1, 'gul'], [2, 2, 'gul']]))).toEqual(['unsupportedMotif']);
    expect(validateDesign(design([[0, 0, 'gul'], [0, 0, 'muyuz'], [2, 9, 'gul']]))).toEqual(expect.arrayContaining(['outsideGrid', 'sharedCell']));
    // The reducer: Pass is refused with the reasons; an 8th piece can't be placed.
    expect(run(authored(place(0, 0)), { type: 'pass' })).toMatchObject({ phase: 'authoring', problems: ['tooFew'] });
    const seven = authored(...Array.from({ length: 7 }, (_, index) => place(index % 5, Math.floor(index / 5))));
    const eighth = run(seven, place(4, 4));
    expect(eighth.phase === 'authoring' && eighth.editor.design.pieces).toHaveLength(MAX_PIECES);
    expect(eighth).toMatchObject({ problems: ['tooMany'] });
  });
});

describe("the rebuild can't touch the reference", () => {
  it('the reference is a deep copy of the author’s design and survives any edit', () => {
    const authoredState = authored(...THREE);
    const authorDesign = authoredState.phase === 'authoring' ? authoredState.editor.design : null;
    const reference = toReference(authorDesign!);
    authorDesign!.pieces[0].cell.col = 4;
    expect(reference.marks[0].cell).toEqual({ col: 0, row: 0 });

    let state = run(authoredState, { type: 'pass' }, { type: 'ready' }, play({ type: 'hide' }));
    const before = JSON.stringify((state as Extract<TogetherState, { phase: 'attempt' }>).reference);
    state = run(state, play({ type: 'edit', action: { type: 'place', cell: { col: 0, row: 0 }, motifId: 'jalbyrak' } }), play({ type: 'edit', action: { type: 'move', id: 'p0', cell: { col: 3, row: 3 } } }), play({ type: 'restart' }));
    const attempt = state as Extract<TogetherState, { phase: 'attempt' }>;
    expect(JSON.stringify(attempt.reference)).toBe(before);
    attempt.attempt.editor.design.pieces.forEach((piece) => (piece.cell.col = 9));
    expect(JSON.stringify(attempt.reference)).toBe(before);
    // `restart` of the solo game isn't used here (retry goes through the privacy screen).
    expect(attempt.attempt.editor.design.pieces).toHaveLength(1);
  });
});

describe('matching and feedback (the solo model)', () => {
  it('compares motif and cell positions', () => {
    let state = run(authored(...THREE), { type: 'pass' }, { type: 'ready' }, play({ type: 'hide' }));
    state = run(state, play({ type: 'edit', action: { type: 'place', cell: { col: 0, row: 0 }, motifId: 'gul' } }), play({ type: 'edit', action: { type: 'place', cell: { col: 2, row: 2 }, motifId: 'gul' } }), play({ type: 'edit', action: { type: 'place', cell: { col: 3, row: 3 }, motifId: 'gul' } }), play({ type: 'check' }));
    expect(state.phase === 'attempt' && state.attempt.feedback).toEqual({ matched: 1, missing: 1, extra: 1, wrongMotif: 1, solved: false });
  });

  it('every valid authored pattern can be solved with the controls offered', () => {
    // Deterministic pseudo-random patterns over the whole grid and every supported motif.
    let seed = 7;
    const next = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    for (let round = 0; round < 60; round += 1) {
      const count = 3 + Math.floor(next() * 5);
      const cells = [...ALL_CELLS].sort(() => next() - 0.5).slice(0, count);
      let state = authored(...cells.map((cell) => place(cell.col, cell.row, TOGETHER_MOTIFS[Math.floor(next() * TOGETHER_MOTIFS.length)])));
      state = run(state, { type: 'pass' });
      expect(state.phase).toBe('pass');
      state = run(state, { type: 'ready' }, play({ type: 'hide' }));
      const { reference } = state as Extract<TogetherState, { phase: 'attempt' }>;
      for (const mark of reference.marks) {
        expect(rebuildMotifs()).toContain(mark.motifId);
        state = run(state, play({ type: 'edit', action: { type: 'place', cell: mark.cell, motifId: mark.motifId } }));
      }
      state = run(state, play({ type: 'check' }));
      const attempt = (state as Extract<TogetherState, { phase: 'attempt' }>).attempt;
      expect(attempt.phase).toBe('done');
      expect(compare(reference, attempt.editor.design).solved).toBe(true);
      expect(new Set(reference.marks.map((mark) => cellKey(mark.cell))).size).toBe(count);
    }
  });
});

describe('the screen keeps the reference hidden until Ready', () => {
  let screen: ReactTestRenderer;
  const all = (testID: string) => screen.root.findAll((node: ReactTestInstance) => node.props.testID === testID && typeof node.type === 'string');
  const has = (predicate: (testID: string) => boolean) => screen.root.findAll((node: ReactTestInstance) => typeof node.props.testID === 'string' && predicate(node.props.testID)).length > 0;
  const press = (testID: string) => act(() => (screen.root.findAll((node: ReactTestInstance) => node.props.testID === testID && typeof node.props.onPress === 'function')[0].props.onPress as () => void)());
  afterEach(() => act(() => screen.unmount()));

  it('pass screen shows nothing of the pattern; Ready shows the grid and the described list', () => {
    act(() => {
      screen = create(createElement(RememberTogetherScreen, { onPressBack: () => undefined }));
    });
    press('together-start');
    for (const id of ['sym-cell-0-0', 'sym-cell-1-1', 'sym-cell-2-2']) press(id);
    press('together-pass');
    expect(has((id) => id === 'together-pass-screen')).toBe(true);
    expect(has((id) => id.startsWith('remember-reference') || id === 'remember-described' || id.startsWith('sym-cell'))).toBe(false);
    press('together-ready');
    expect(has((id) => id === 'remember-described')).toBe(true);
    expect(has((id) => id.startsWith('remember-reference'))).toBe(true);
  });
});
