import { cellKey, GRID, playgroundReducer, resultSet, startPlayground, type Cell, type Design, type PlaygroundAction, type PlaygroundState } from './playgroundModel';

/**
 * Remember the Pattern - see a small authored pattern, hide it when ready,
 * rebuild it on the playground's grid (same editor model: place, remove,
 * move, Undo), then Check. Matching is decided on the model: the set of
 * (cell, motif). "Show again" is always allowed and marks the attempt as
 * assisted. A practice game - it measures nothing about the player.
 */
export type Level = 'easy' | 'medium' | 'hard';
export const LEVELS: Level[] = ['easy', 'medium', 'hard'];
/** Optional timed viewing (seconds); null = untimed (the default). */
export const VIEW_TIMES = [null, 10, 20] as const;
export type ViewTime = (typeof VIEW_TIMES)[number];

export type Mark = { cell: Cell; motifId: string };
export type RememberPattern = { id: string; level: Level; marks: Mark[] };
const m = (motifId: string, cells: [number, number][]): Mark[] => cells.map(([col, row]) => ({ cell: { col, row }, motifId }));

/** Authored practice patterns (positions and motif choices only - no meaning is claimed). */
export const REMEMBER_PATTERNS: RememberPattern[] = [
  { id: 'line', level: 'easy', marks: m('gul', [[1, 2], [2, 2], [3, 2]]) },
  { id: 'corners', level: 'easy', marks: [...m('muyuz', [[0, 0], [4, 4]]), ...m('gul', [[2, 2]])] },
  { id: 'cross', level: 'medium', marks: [...m('bulak', [[2, 1], [2, 3], [1, 2], [3, 2]]), ...m('gul', [[2, 2]])] },
  { id: 'steps', level: 'medium', marks: [...m('jalbyrak', [[0, 4], [1, 3], [2, 2]]), ...m('muyuz', [[3, 1], [4, 0]])] },
  { id: 'frame', level: 'hard', marks: [...m('kochkorMuyuz', [[0, 0], [4, 0], [0, 4], [4, 4]]), ...m('tortKulak', [[2, 0], [2, 4]]), ...m('gul', [[2, 2]])] },
  { id: 'garden', level: 'hard', marks: [...m('jalbyrak', [[1, 1], [3, 1], [1, 3], [3, 3]]), ...m('bulak', [[2, 1]]), ...m('gul', [[2, 3]]), ...m('muyuz', [[0, 2]])] },
];
export const PIECES_BY_LEVEL: Record<Level, [number, number]> = { easy: [2, 3], medium: [4, 5], hard: [6, 7] };

/** Integrity: cells in the grid, one motif per cell, piece count within its level's range. */
export function validatePattern(pattern: RememberPattern): string[] {
  const problems: string[] = [];
  const cells = new Set<string>();
  for (const mark of pattern.marks) {
    if (!(mark.cell.col >= 0 && mark.cell.col < GRID && mark.cell.row >= 0 && mark.cell.row < GRID)) problems.push(`${pattern.id}: cell outside the grid`);
    const key = cellKey(mark.cell);
    if (cells.has(key)) problems.push(`${pattern.id}: two motifs on ${key}`);
    cells.add(key);
  }
  const [min, max] = PIECES_BY_LEVEL[pattern.level];
  if (pattern.marks.length < min || pattern.marks.length > max) problems.push(`${pattern.id}: ${pattern.marks.length} pieces for ${pattern.level}`);
  return problems;
}

export const motifsOf = (pattern: RememberPattern) => [...new Set(pattern.marks.map((mark) => mark.motifId))];

export type Feedback = { matched: number; missing: number; extra: number; wrongMotif: number; solved: boolean };
/** Compare the rebuilt design with the pattern: exact (cell, motif) matches; a right cell with another motif is "wrong motif". */
export function compare(pattern: RememberPattern, design: Design): Feedback {
  const want = new Map(pattern.marks.map((mark) => [cellKey(mark.cell), mark.motifId]));
  const have = new Map(design.pieces.map((piece) => [cellKey(piece.cell), piece.motifId]));
  let matched = 0;
  let wrongMotif = 0;
  for (const [cell, motif] of want) {
    if (have.get(cell) === motif) matched += 1;
    else if (have.has(cell)) wrongMotif += 1;
  }
  const missing = [...want.keys()].filter((cell) => !have.has(cell)).length;
  const extra = [...have.keys()].filter((cell) => !want.has(cell)).length;
  // Solved = the playground's own (cell, motif) set comparison (no symmetry here).
  return { matched, missing, extra, wrongMotif, solved: equalSets(pattern, design) };
}
export const equalSets = (pattern: RememberPattern, design: Design) => {
  const want = new Set(pattern.marks.map((mark) => `${cellKey(mark.cell)}|${mark.motifId}`));
  const have = resultSet({ ...design, mode: 'none' });
  return want.size === have.size && [...want].every((key) => have.has(key));
};

/**
 * viewing  - the reference is shown (hide it when ready, or after the optional timer)
 * building - rebuild it; Check gives gentle feedback
 * done     - matched
 */
export type RememberPhase = 'viewing' | 'building' | 'done';
export type RememberState = { pattern: RememberPattern; viewTime: ViewTime; phase: RememberPhase; editor: PlaygroundState; assisted: boolean; views: number; checks: number; feedback: Feedback | null };

export function startRemember(pattern: RememberPattern, viewTime: ViewTime = null): RememberState {
  return { pattern, viewTime, phase: 'viewing', editor: startPlayground({ pieces: [], mode: 'none' }, 'none'), assisted: false, views: 1, checks: 0, feedback: null };
}

export type RememberAction = { type: 'hide' } | { type: 'showAgain' } | { type: 'edit'; action: PlaygroundAction } | { type: 'check' } | { type: 'restart' };

export function rememberReducer(state: RememberState, action: RememberAction): RememberState {
  switch (action.type) {
    case 'hide':
      return state.phase === 'viewing' ? { ...state, phase: 'building' } : state;
    case 'showAgain':
      // Looking again is always fine - the attempt is then marked as assisted. The rebuild so far is kept.
      return state.phase === 'building' ? { ...state, phase: 'viewing', assisted: true, views: state.views + 1, feedback: null } : state;
    case 'edit': {
      if (state.phase !== 'building' || action.action.type === 'mode') return state;
      const editor = playgroundReducer(state.editor, action.action);
      return editor === state.editor ? state : { ...state, editor, feedback: null };
    }
    case 'check': {
      if (state.phase !== 'building') return state;
      const feedback = compare(state.pattern, state.editor.design);
      return { ...state, checks: state.checks + 1, feedback, phase: feedback.solved ? 'done' : 'building' };
    }
    case 'restart':
      return startRemember(state.pattern, state.viewTime);
  }
}
