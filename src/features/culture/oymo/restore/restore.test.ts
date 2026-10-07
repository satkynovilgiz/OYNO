import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import { takeCreatorHandoff, handOffToCreator } from '@/services/culture/oymoHandoff';

import { BOARD_SLOTS, correctCount, isSolved, puzzleReducer, startPuzzle, toCreatorState, visibleRotation, type PuzzleState } from './restoreModel';
import { DESCRIBED_MOTIFS, MOTIF_ARTICLES, RESTORE_PUZZLES, rotationOrder, type Placement, type RestorePuzzle } from './restorePuzzles';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));

/** Solves a puzzle with player actions only: select a matching tray piece, turn it, place it. */
function solve(puzzle: RestorePuzzle, choose: (placement: Placement) => Placement = (placement) => placement): PuzzleState {
  let state = startPuzzle(puzzle);
  for (const wanted of puzzle.target.map(choose)) {
    const piece = state.board.tray.find((item) => item.motifId === wanted.motifId && item.color === wanted.color)!;
    state = puzzleReducer(state, { type: 'select', pieceId: piece.id });
    let turns = 0;
    while (state.board.tray.find((item) => item.id === piece.id)!.rotation !== wanted.rotation && turns < 4) {
      state = puzzleReducer(state, { type: 'turn' });
      turns += 1;
    }
    state = puzzleReducer(state, { type: 'slot', slot: wanted.slot });
  }
  return state;
}

describe('the six puzzles', () => {
  it('are well-formed: slots on the board, no overlaps, a tray piece for every target', () => {
    expect(RESTORE_PUZZLES).toHaveLength(6);
    for (const puzzle of RESTORE_PUZZLES) {
      const slots = [...puzzle.fixed, ...puzzle.target].map((placement) => placement.slot);
      expect(new Set(slots).size).toBe(slots.length);
      for (const slot of slots) expect(slot >= 0 && slot < BOARD_SLOTS).toBe(true);
      expect(puzzle.trayRotations).toHaveLength(puzzle.target.length);
    }
  });

  it('are all solvable with player actions', () => {
    for (const puzzle of RESTORE_PUZZLES) expect([puzzle.id, isSolved(solve(puzzle))]).toEqual([puzzle.id, true]);
  });

  it('get harder: never fewer pieces to place, and more turning by the end', () => {
    const pieces = RESTORE_PUZZLES.map((puzzle) => puzzle.target.length);
    for (let index = 1; index < pieces.length; index += 1) expect(pieces[index]).toBeGreaterThanOrEqual(pieces[index - 1]);
    const turnsNeeded = (puzzle: RestorePuzzle) => puzzle.target.reduce((sum, placement, index) => sum + ((placement.rotation - puzzle.trayRotations[index] + 360) % 360) / 90, 0);
    expect(turnsNeeded(RESTORE_PUZZLES[0])).toBe(0);
    expect(turnsNeeded(RESTORE_PUZZLES[5])).toBeGreaterThan(turnsNeeded(RESTORE_PUZZLES[2]));
    expect(RESTORE_PUZZLES[5].fixed).toEqual([]);
  });
});

describe('equivalent solutions', () => {
  it('rotations a motif looks the same under are accepted - and only those', () => {
    expect(rotationOrder('tortKulak')).toBe(4);
    expect(rotationOrder('umaiOyumu')).toBe(2);
    expect(rotationOrder('kochkorMuyuz')).toBe(1);
    expect(visibleRotation('umaiOyumu', 270)).toBe(visibleRotation('umaiOyumu', 90));
    expect(visibleRotation('umaiOyumu', 0)).not.toBe(visibleRotation('umaiOyumu', 90));
    const talisman = RESTORE_PUZZLES.find((puzzle) => puzzle.id === 'talisman')!;
    // The disc turned 270 instead of 90 looks identical: solved.
    expect(isSolved(solve(talisman, (placement) => (placement.motifId === 'umaiOyumu' ? { ...placement, rotation: 270 } : placement)))).toBe(true);
    // Turned 0 does NOT look the same: not solved.
    expect(isSolved(solve(talisman, (placement) => (placement.motifId === 'umaiOyumu' ? { ...placement, rotation: 0 } : placement)))).toBe(false);
    // The medallion's four-eared centre in any turn.
    const medallion = RESTORE_PUZZLES.find((puzzle) => puzzle.id === 'medallion')!;
    for (const rotation of [0, 90, 180, 270] as const) expect(isSolved(solve(medallion, (placement) => (placement.motifId === 'tortKulak' ? { ...placement, rotation } : placement)))).toBe(true);
    // A horn the wrong way round is wrong.
    expect(isSolved(solve(medallion, (placement) => (placement.slot === 1 ? { ...placement, rotation: 180 } : placement)))).toBe(false);
  });

  it('identical pieces in swapped places are the same solution', () => {
    const twins = RESTORE_PUZZLES[0];
    let state = startPuzzle(twins);
    state = puzzleReducer(state, { type: 'select', pieceId: 'piece-1' });
    state = puzzleReducer(state, { type: 'slot', slot: 3 });
    state = puzzleReducer(state, { type: 'select', pieceId: 'piece-0' });
    state = puzzleReducer(state, { type: 'slot', slot: 5 });
    expect(isSolved(state)).toBe(true);
  });

  it('the visual symmetry claims match the SVG geometry', () => {
    const source = fs.readFileSync(path.join(__dirname, '../motifs.tsx'), 'utf8');
    const block = (name: string) => source.slice(source.indexOf(`function ${name}`), source.indexOf('\n}\n', source.indexOf(`function ${name}`)));
    // Tort kulak: a centred diamond and a tab at all four edge midpoints.
    const tort = block('TortKulakShape');
    for (const tab of ['M12 3v3', 'M21 12h-3', 'M12 21v-3', 'M3 12h3', 'M12 3l9 9-9 9-9-9Z']) expect(tort).toContain(tab);
    // Umai oyumu: centred ring; each wing has its 180-degree twin (point mirrored through 12,12, deltas negated).
    const umai = block('UmaiOyumuShape');
    expect(umai).toContain('cx={12} cy={12}');
    for (const [wing, twin] of [['M9 12c-3-1-5-3-6-6', 'M15 12c3 1 5 3 6 6'], ['M15 12c3-1 5-3 6-6', 'M9 12c-3 1-5 3-6 6']]) {
      expect(umai).toContain(wing);
      expect(umai).toContain(twin);
    }
  });
});

describe('controls are predictable', () => {
  it('Undo goes back exactly one change; Reset returns to the start', () => {
    const puzzle = RESTORE_PUZZLES[2];
    const start = startPuzzle(puzzle);
    let state = puzzleReducer(start, { type: 'select', pieceId: 'piece-0' });
    state = puzzleReducer(state, { type: 'slot', slot: 1 });
    const afterFirst = state.board;
    state = puzzleReducer(state, { type: 'select', pieceId: 'piece-1' });
    state = puzzleReducer(state, { type: 'turn' });
    state = puzzleReducer(state, { type: 'undo' });
    expect(state.board.slots).toEqual(afterFirst.slots);
    expect(state.board.tray).toEqual(afterFirst.tray);
    // One step only.
    expect(puzzleReducer(state, { type: 'undo' })).toBe(state);
    expect(puzzleReducer(state, { type: 'reset' }).board).toEqual(start.board);
  });

  it('fixed pieces never move; a placed piece can go back to the tray or swap', () => {
    const puzzle = RESTORE_PUZZLES[0];
    let state = startPuzzle(puzzle);
    expect(puzzleReducer(state, { type: 'select', pieceId: 'fixed-4' })).toBe(state);
    state = puzzleReducer(state, { type: 'select', pieceId: 'piece-0' });
    expect(puzzleReducer(state, { type: 'slot', slot: 4 })).toBe(state);
    state = puzzleReducer(state, { type: 'slot', slot: 0 });
    state = puzzleReducer(state, { type: 'select', pieceId: 'piece-0' });
    state = puzzleReducer(state, { type: 'toTray' });
    expect(state.board.slots[0]).toBeNull();
    expect(state.board.tray.map((piece) => piece.id).sort()).toEqual(['piece-0', 'piece-1']);
  });

  it('Hint places one missing piece correctly, counts, and a full hint run solves the puzzle', () => {
    let state = startPuzzle(RESTORE_PUZZLES[5]);
    state = puzzleReducer(state, { type: 'hint' });
    expect(correctCount(state)).toBe(1);
    expect(state.hintsUsed).toBe(1);
    for (let index = 0; index < 20 && !isSolved(state); index += 1) state = puzzleReducer(state, { type: 'hint' });
    expect(isSolved(state)).toBe(true);
    // A solved board stays solved.
    expect(puzzleReducer(state, { type: 'select', pieceId: 'piece-0' })).toBe(state);
  });
});

describe('puzzle -> Creator handoff', () => {
  it('a solved pattern becomes an editable, unsaved deep copy, taken once', () => {
    const solved = solve(RESTORE_PUZZLES[5]);
    const creator = toCreatorState(solved);
    expect(creator.layers).toHaveLength(9);
    expect(creator.layers.every((layer) => /^layer\d+$/.test(layer.id) && layer.visible)).toBe(true);
    expect(creator).not.toHaveProperty('id');
    handOffToCreator(creator);
    const taken = takeCreatorHandoff()!;
    expect(taken).toEqual(creator);
    taken.layers[0].rotation = 45; // editing the copy...
    expect(creator.layers[0].rotation).not.toBe(45); // ...changes nothing else
    expect(isSolved(solved)).toBe(true);
    expect(takeCreatorHandoff()).toBeNull();
  });

  it('playing never saves or changes saved creations; the Creator opens it unsaved', () => {
    for (const file of ['RestorePatternScreen.tsx', 'restoreModel.ts', 'restorePuzzles.ts']) expect(fs.readFileSync(path.join(__dirname, file), 'utf8')).not.toMatch(/saveOymoCreation|deleteOymoCreation|useOymoCreations|useProgressStore/);
    const creator = fs.readFileSync(path.join(__dirname, '../OymoCreatorScreen.tsx'), 'utf8');
    expect(creator).toContain('useState(() => takeCreatorHandoff())');
    expect(creator).toContain("t('restorePattern.openedCopy')");
  });
});

describe('content and languages', () => {
  it('descriptions only for motifs with a reviewed article text; links only to existing motif articles', () => {
    const root = path.join(__dirname, '../../../../..');
    const reviewedEn = JSON.parse(fs.readFileSync(path.join(root, 'content/translations/culture_batch1.en.json'), 'utf8')) as Record<string, Record<string, string>>;
    for (const motif of DESCRIBED_MOTIFS) expect((en as unknown as { restorePattern: { descriptions: Record<string, string> } }).restorePattern.descriptions[motif]).toBe(reviewedEn[MOTIF_ARTICLES[motif]!].cultural_meaning);
    const data = fs.readFileSync(path.join(root, 'src/features/culture/data.ts'), 'utf8');
    for (const article of Object.values(MOTIF_ARTICLES)) expect(data).toContain(`'${article}'`);
  });

  it('KG / RU / EN', () => {
    const keys = Object.keys((en as unknown as { restorePattern: Record<string, unknown> }).restorePattern);
    for (const locale of [kg, ru]) for (const key of keys) expect([key, key in (locale as unknown as { restorePattern: Record<string, unknown> }).restorePattern]).toEqual([key, true]);
  });
});
