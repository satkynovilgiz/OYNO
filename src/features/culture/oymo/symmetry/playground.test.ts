import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import { CANVAS_SIZE } from '@/features/culture/oymo/components/OymoCanvas';
import { getLayerRenderPoints } from '@/services/culture/oymoEditor';
import { handOffToCreator, takeCreatorHandoff } from '@/services/culture/oymoHandoff';

import { CELL, CHALLENGES, compareToTarget, GRID, HISTORY_MAX, isSolved, mirroredCells, MODES, playgroundReducer, resultOf, resultSet, startPlayground, toCreatorCopy, type Design, type PlaygroundState } from './playgroundModel';

const cells = (list: { col: number; row: number }[]) => list.map((cell) => `${cell.col},${cell.row}`).sort();
const apply = (state: PlaygroundState, ...actions: Parameters<typeof playgroundReducer>[1][]) => actions.reduce(playgroundReducer, state);

describe('transformations (the Creator\'s own symmetry math)', () => {
  it('none: the cell itself; mirror: + the column reflected; four-way: all four quarters', () => {
    expect(cells(mirroredCells({ col: 0, row: 1 }, 'none'))).toEqual(['0,1']);
    expect(cells(mirroredCells({ col: 0, row: 1 }, 'mirror'))).toEqual(['0,1', '4,1']);
    expect(cells(mirroredCells({ col: 1, row: 0 }, 'fourWay'))).toEqual(['1,0', '1,4', '3,0', '3,4']);
    // On a centre line a copy lands on itself: one cell, not two.
    expect(cells(mirroredCells({ col: 2, row: 3 }, 'mirror'))).toEqual(['2,3']);
    expect(cells(mirroredCells({ col: 2, row: 2 }, 'fourWay'))).toEqual(['2,2']);
    expect(cells(mirroredCells({ col: 2, row: 0 }, 'fourWay'))).toEqual(['2,0', '2,4']);
  });

  it('every copy stays inside the 5 x 5 grid, for every cell and mode', () => {
    for (const mode of MODES) for (let col = 0; col < GRID; col += 1) for (let row = 0; row < GRID; row += 1) for (const cell of mirroredCells({ col, row }, mode)) expect(cell.col >= 0 && cell.col < GRID && cell.row >= 0 && cell.row < GRID).toBe(true);
  });

  it('the result marks the original apart from its copies, and never doubles a cell', () => {
    const design: Design = { mode: 'fourWay', pieces: [{ id: 'a', motifId: 'gul', cell: { col: 0, row: 0 } }] };
    const result = resultOf(design);
    expect(result).toHaveLength(4);
    expect(result.filter((mark) => mark.source)).toEqual([{ cell: { col: 0, row: 0 }, motifId: 'gul', source: true }]);
  });

  it('matches what the Creator draws for the same layers and mode', () => {
    const design: Design = { mode: 'fourWay', pieces: [{ id: 'a', motifId: 'gul', cell: { col: 1, row: 0 } }, { id: 'b', motifId: 'bulak', cell: { col: 2, row: 2 } }] };
    const copy = toCreatorCopy(design, '#2F5D3A');
    const creatorCells = copy.state.layers.flatMap((layer) => getLayerRenderPoints(layer, copy.symmetry, CANVAS_SIZE).map((point) => `${Math.floor(point.x / CELL)},${Math.floor(point.y / CELL)}|${layer.motifId}`));
    expect(new Set(creatorCells)).toEqual(resultSet(design));
  });
});

describe('editing, undo and reset', () => {
  it('place, move, remove, change mode; invalid actions change nothing and add no undo step', () => {
    let state = startPlayground();
    state = apply(state, { type: 'place', cell: { col: 0, row: 0 }, motifId: 'gul' });
    const id = state.design.pieces[0].id;
    expect(apply(state, { type: 'place', cell: { col: 0, row: 0 }, motifId: 'muyuz' })).toBe(state); // occupied
    expect(apply(state, { type: 'place', cell: { col: 5, row: 0 }, motifId: 'muyuz' })).toBe(state); // outside
    expect(apply(state, { type: 'move', id, cell: { col: 0, row: 0 } })).toBe(state); // same cell
    expect(apply(state, { type: 'mode', mode: 'mirror' })).toBe(state); // already mirror
    state = apply(state, { type: 'move', id, cell: { col: 1, row: 2 } }, { type: 'mode', mode: 'fourWay' });
    expect(state.design).toEqual({ mode: 'fourWay', pieces: [{ id, motifId: 'gul', cell: { col: 1, row: 2 } }] });
    expect(state.history).toHaveLength(3);
  });

  it('undo steps back one change at a time; reset is itself undoable; history is bounded', () => {
    let state = apply(startPlayground(), { type: 'place', cell: { col: 0, row: 0 }, motifId: 'gul' }, { type: 'mode', mode: 'fourWay' });
    const placed = state.design;
    state = apply(state, { type: 'reset' });
    expect(state.design.pieces).toEqual([]);
    state = apply(state, { type: 'undo' });
    expect(state.design).toEqual(placed);
    state = apply(state, { type: 'undo' }, { type: 'undo' });
    expect(state.design.pieces).toEqual([]);
    expect(apply(state, { type: 'undo' })).toBe(state);
    for (let index = 0; index < HISTORY_MAX + 20; index += 1) state = apply(state, { type: 'mode', mode: index % 2 ? 'mirror' : 'none' });
    expect(state.history.length).toBe(HISTORY_MAX);
  });
});

describe('challenges (decided on the model)', () => {
  const place = (state: PlaygroundState, motifId: string, col: number, row: number) => apply(state, { type: 'place', cell: { col, row }, motifId });

  it('each challenge has a solution with few pieces, and is not solved by an empty or wrong design', () => {
    const twins = CHALLENGES.find((entry) => entry.id === 'twins')!;
    let state = startPlayground({ pieces: [], mode: 'mirror' });
    expect(isSolved(twins, state.design)).toBe(false);
    state = place(place(state, 'muyuz', 0, 1), 'gul', 2, 3);
    expect(isSolved(twins, state.design)).toBe(true);
    // Same result, but the challenge's rule is fixed: four-way is not accepted.
    expect(isSolved(twins, { ...state.design, mode: 'fourWay' })).toBe(false);

    const corners = CHALLENGES.find((entry) => entry.id === 'corners')!;
    state = place(place(startPlayground({ pieces: [], mode: 'fourWay' }), 'kochkorMuyuz', 4, 4), 'gul', 2, 2);
    expect(isSolved(corners, state.design)).toBe(true);

    const which = CHALLENGES.find((entry) => entry.id === 'whichRule')!;
    state = place(place(startPlayground({ pieces: [], mode: 'fourWay' }), 'tortKulak', 3, 3), 'bulak', 2, 0);
    expect(isSolved(which, state.design)).toBe(true);
    expect(isSolved(which, { ...state.design, mode: 'mirror' })).toBe(false);
  });

  it('an extra or a wrong motif means not solved; the hint counts what is missing and extra', () => {
    const twins = CHALLENGES.find((entry) => entry.id === 'twins')!;
    const design: Design = { mode: 'mirror', pieces: [{ id: 'a', motifId: 'muyuz', cell: { col: 0, row: 1 } }, { id: 'b', motifId: 'gul', cell: { col: 2, row: 3 } }, { id: 'c', motifId: 'gul', cell: { col: 0, row: 0 } }] };
    expect(isSolved(twins, design)).toBe(false);
    expect(compareToTarget(twins, design)).toEqual({ missing: 0, extra: 2 });
    const wrongMotif: Design = { mode: 'mirror', pieces: [{ id: 'a', motifId: 'gul', cell: { col: 0, row: 1 } }, { id: 'b', motifId: 'gul', cell: { col: 2, row: 3 } }] };
    expect(compareToTarget(twins, wrongMotif)).toEqual({ missing: 2, extra: 2 });
  });
});

describe('Open in Creator: an unsaved, isolated copy', () => {
  it('the copy is deep; changing it never touches the playground design; it is taken once', () => {
    const state = apply(startPlayground(), { type: 'place', cell: { col: 1, row: 1 }, motifId: 'gul' }, { type: 'mode', mode: 'fourWay' });
    const before = JSON.stringify(state.design);
    const copy = toCreatorCopy(state.design, '#2F5D3A');
    handOffToCreator(copy.state, { symmetry: copy.symmetry, source: 'symmetry' });
    const taken = takeCreatorHandoff()!;
    expect(taken).toMatchObject({ symmetry: 'fourWay', source: 'symmetry' });
    expect(taken.state).not.toHaveProperty('id'); // not linked to any saved creation
    taken.state.layers[0].point.x = 0;
    taken.state.layers.push({ ...taken.state.layers[0], id: 'extra' });
    expect(JSON.stringify(state.design)).toBe(before);
    expect(copy.state.layers).toHaveLength(1);
    expect(takeCreatorHandoff()).toBeNull();
  });
});

describe('texts', () => {
  it('every rule, challenge and note exists in KG, RU and EN; geometry and culture are separate', () => {
    for (const lang of [en, ru, kg]) {
      const section = (lang as unknown as { symmetryPlayground: { rules: Record<string, string>; challenge: Record<string, { title: string; task: string }>; cultureNote: string; mathLabel: string; cultureLabel: string } }).symmetryPlayground;
      for (const mode of MODES) expect(section.rules[mode]).toBeTruthy();
      for (const entry of CHALLENGES) expect(section.challenge[entry.id].task).toBeTruthy();
      expect(section.mathLabel).not.toBe(section.cultureLabel);
    }
    // The playground explains geometry only - no motif meanings are made up.
    expect(en.symmetryPlayground.cultureNote).toContain('does not say what any motif means');
    expect(JSON.stringify(en.symmetryPlayground)).not.toMatch(/symboli[sz]es|represents|stands for/i);
  });
});
