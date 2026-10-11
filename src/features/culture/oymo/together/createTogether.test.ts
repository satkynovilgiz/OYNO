/** Create Together: turn transitions, Undo boundaries, reset confirmation, the layer limit, deep copies. */
import { handOffToCreator, takeCreatorHandoff } from '@/services/culture/oymoHandoff';
import { MAX_OYMO_LAYERS, removeLayer } from '@/services/culture/oymoEditor';

import { finalDesign, placeMotif, START, togetherReducer, type TogetherAction, type TogetherState } from './togetherCreateModel';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));

const run = (state: TogetherState, ...actions: TogetherAction[]) => actions.reduce(togetherReducer, state);
const place = (x: number): TogetherAction => ({ type: 'edit', change: placeMotif({ x, y: 100 }, 'gul', '#2F5233') });
const layers = (state: TogetherState) => ('design' in state ? state.design.layers.map((layer) => layer.point.x) : []);

describe('turns', () => {
  it('A plays, passes (design kept), B starts explicitly, ... up to the turn limit, then finish', () => {
    let state = run(START, { type: 'name', player: 'a', name: 'Aida' }, { type: 'turnLimit', turnLimit: 2 }, { type: 'begin' });
    expect(state).toMatchObject({ phase: 'turn', player: 'a', turn: 1 });
    state = run(state, place(60), place(90), { type: 'pass' });
    expect(state).toMatchObject({ phase: 'pass', next: 'b' });
    expect(layers(state)).toEqual([60, 90]);
    // Nothing changes until B starts.
    expect(run(state, place(120), { type: 'undo' })).toBe(state);
    state = run(state, { type: 'startTurn' });
    expect(state).toMatchObject({ phase: 'turn', player: 'b', turn: 2 });
    state = run(state, place(150), { type: 'pass' });
    expect(state).toMatchObject({ phase: 'finish', turns: 2 });
    expect(layers(state)).toEqual([60, 90, 150]);
    expect(run(state, { type: 'newSession' })).toMatchObject({ phase: 'setup', names: { a: 'Aida', b: '' } });
  });

  it('free creation never ends by itself; finish any time', () => {
    let state = run(START, { type: 'turnLimit', turnLimit: null }, { type: 'begin' });
    for (let index = 0; index < 10; index += 1) state = run(state, place(10 + index), { type: 'pass' }, { type: 'startTurn' });
    expect(state).toMatchObject({ phase: 'turn', turn: 11 });
    expect(run(state, { type: 'finish' }).phase).toBe('finish');
  });
});

describe('undo and reset', () => {
  it("Undo only reaches this turn's own steps - never the other player's turn", () => {
    let state = run(START, { type: 'begin' }, place(60), place(90), { type: 'pass' }, { type: 'startTurn' }, place(150));
    state = run(state, { type: 'undo' }, { type: 'undo' }, { type: 'undo' });
    expect(layers(state)).toEqual([60, 90]);
    expect(state.phase === 'turn' && state.history).toEqual([]);
    // Removing a layer is an undoable step of this turn too.
    const firstId = state.phase === 'turn' ? state.design.layers[0].id : '';
    state = run(state, { type: 'edit', change: (design) => removeLayer(design, firstId) }, { type: 'undo' });
    expect(layers(state)).toEqual([60, 90]);
  });

  it('clearing the whole design needs a confirmation (and can be undone within the turn)', () => {
    let state = run(START, { type: 'begin' }, place(60), { type: 'pass' }, { type: 'startTurn' }, place(90));
    expect(run(state, { type: 'confirmReset' })).toBe(state); // no confirmation asked yet
    state = run(state, { type: 'askReset' });
    expect(state.phase === 'turn' && state.confirmReset).toBe(true);
    expect(layers(run(state, { type: 'cancelReset' }))).toEqual([60, 90]);
    state = run(state, { type: 'confirmReset' });
    expect(layers(state)).toEqual([]);
    expect(layers(run(state, { type: 'undo' }))).toEqual([60, 90]);
  });
});

describe('limits and copies', () => {
  it("respects the Creator's layer limit (a place at the limit changes nothing and adds no undo step)", () => {
    let state = run(START, { type: 'turnLimit', turnLimit: null }, { type: 'begin' });
    for (let index = 0; index < MAX_OYMO_LAYERS + 3; index += 1) state = run(state, place(index % 300));
    expect(layers(state)).toHaveLength(MAX_OYMO_LAYERS);
    expect(state.phase === 'turn' && state.history).toHaveLength(MAX_OYMO_LAYERS);
  });

  it('the Creator gets the exact final design as an independent copy, with no player names', () => {
    const state = run(START, { type: 'name', player: 'a', name: 'Aida' }, { type: 'begin' }, place(60), { type: 'symmetry', symmetry: 'fourWay' }, { type: 'finish' }) as Extract<TogetherState, { phase: 'finish' }>;
    const final = finalDesign(state);
    expect(final.state).toEqual(state.design);
    expect(final.symmetry).toBe('fourWay');
    final.state.layers[0].point.x = -1;
    expect(state.design.layers[0].point.x).toBe(60);
    handOffToCreator(final.state, { symmetry: final.symmetry, source: 'together', name: 'Our pattern' });
    const handed = takeCreatorHandoff()!;
    expect(handed).toMatchObject({ source: 'together', name: 'Our pattern', symmetry: 'fourWay' });
    expect(JSON.stringify(handed)).not.toContain('Aida');
  });
});
