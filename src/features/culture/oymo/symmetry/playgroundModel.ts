import { CANVAS_SIZE } from '@/features/culture/oymo/components/OymoCanvas';
import type { MotifLayer, OymoEditorState } from '@/services/culture/oymoEditor';
import { computeMirroredPoints, type SymmetryMode } from '@/services/culture/symmetry';

/**
 * Symmetry Playground - pure rules. A small source design on a 5 x 5 grid
 * (cell centres in the Oymo canvas's own 300 x 300 coordinates) and its
 * result under one of the Creator's REAL symmetry modes, computed by the
 * Creator's own `computeMirroredPoints`:
 *   none    the source only
 *   mirror  + each position reflected across the vertical centre line
 *   fourWay + reflected across the vertical AND horizontal centre lines
 *           (so also turned half a turn about the centre)
 * As in the Creator, only POSITIONS are reflected: each motif keeps its own
 * orientation. Success in a challenge is decided on this model - the set
 * of (cell, motif) in the result - never on pixels.
 */
export const GRID = 5;
export const CELL = CANVAS_SIZE / GRID;
export const MODES: SymmetryMode[] = ['none', 'mirror', 'fourWay'];
export const HISTORY_MAX = 50;

export type Cell = { col: number; row: number };
export type Piece = { id: string; motifId: string; cell: Cell };
export type Design = { pieces: Piece[]; mode: SymmetryMode };
/** `lockedMode`: a challenge's fixed rule - no action (or undo) can leave it. */
export type PlaygroundState = { design: Design; history: Design[]; nextId: number; lockedMode: SymmetryMode | null; /** Where Reset returns to in this session. */ start: Design };

export const cellKey = (cell: Cell) => `${cell.col},${cell.row}`;
export const centre = (cell: Cell) => ({ x: (cell.col + 0.5) * CELL, y: (cell.row + 0.5) * CELL });
const toCell = (point: { x: number; y: number }): Cell => ({ col: Math.floor(point.x / CELL), row: Math.floor(point.y / CELL) });
const inGrid = (cell: Cell) => Number.isInteger(cell.col) && Number.isInteger(cell.row) && cell.col >= 0 && cell.row >= 0 && cell.col < GRID && cell.row < GRID;

export const EMPTY_DESIGN: Design = { pieces: [], mode: 'mirror' };
/** A fresh session with its OWN history: entering a challenge, switching, or returning to free play. */
export function startPlayground(design: Design = EMPTY_DESIGN, lockedMode: SymmetryMode | null = null): PlaygroundState {
  const mode = lockedMode ?? design.mode;
  const copy = (): Design => ({ mode, pieces: design.pieces.map((piece) => ({ ...piece, cell: { ...piece.cell } })) });
  return { design: copy(), history: [], nextId: design.pieces.length, lockedMode, start: copy() };
}

/** The starting design of a challenge (or of free play). */
export const challengeStart = (challenge: Challenge | null): Design => (challenge ? { pieces: [], mode: challenge.mode ?? 'none' } : EMPTY_DESIGN);

/** Where a source cell's copies land under a mode (the source cell included). */
export function mirroredCells(cell: Cell, mode: SymmetryMode): Cell[] {
  return computeMirroredPoints(centre(cell), mode, CANVAS_SIZE).map(toCell);
}

export type ResultMark = { cell: Cell; motifId: string; source: boolean };
/** The transformed result: every copy, one entry per (cell, motif); `source` marks the original. */
export function resultOf(design: Design): ResultMark[] {
  const seen = new Map<string, ResultMark>();
  for (const piece of design.pieces) {
    for (const cell of mirroredCells(piece.cell, design.mode)) {
      const key = `${cellKey(cell)}|${piece.motifId}`;
      const source = cellKey(cell) === cellKey(piece.cell);
      const existing = seen.get(key);
      if (!existing || (source && !existing.source)) seen.set(key, { cell, motifId: piece.motifId, source });
    }
  }
  return [...seen.values()];
}

/** The result as a comparable set ("col,row|motif"). */
export const resultSet = (design: Design) => new Set(resultOf(design).map((mark) => `${cellKey(mark.cell)}|${mark.motifId}`));

export type PlaygroundAction =
  | { type: 'place'; cell: Cell; motifId: string }
  | { type: 'remove'; id: string }
  | { type: 'move'; id: string; cell: Cell }
  | { type: 'mode'; mode: SymmetryMode }
  | { type: 'undo' }
  | { type: 'reset' }
  /** Enter a challenge (or free play with null): a NEW history; nothing from before can be undone into it. */
  | { type: 'begin'; challenge: Challenge | null };

function commit(state: PlaygroundState, design: Design, nextId = state.nextId): PlaygroundState {
  return { ...state, design, history: [...state.history, state.design].slice(-HISTORY_MAX), nextId };
}

/** One piece per source cell; anything invalid changes nothing (and adds no undo step). */
export function playgroundReducer(state: PlaygroundState, action: PlaygroundAction): PlaygroundState {
  const { design } = state;
  const occupied = (cell: Cell, except?: string) => design.pieces.some((piece) => piece.id !== except && cellKey(piece.cell) === cellKey(cell));
  switch (action.type) {
    case 'place':
      if (!inGrid(action.cell) || occupied(action.cell)) return state;
      return commit(state, { ...design, pieces: [...design.pieces, { id: `p${state.nextId}`, motifId: action.motifId, cell: { ...action.cell } }] }, state.nextId + 1);
    case 'remove':
      if (!design.pieces.some((piece) => piece.id === action.id)) return state;
      return commit(state, { ...design, pieces: design.pieces.filter((piece) => piece.id !== action.id) });
    case 'move': {
      const piece = design.pieces.find((entry) => entry.id === action.id);
      if (!piece || !inGrid(action.cell) || occupied(action.cell, action.id) || cellKey(piece.cell) === cellKey(action.cell)) return state;
      return commit(state, { ...design, pieces: design.pieces.map((entry) => (entry.id === action.id ? { ...entry, cell: { ...action.cell } } : entry)) });
    }
    case 'mode':
      if (action.mode === design.mode || !MODES.includes(action.mode) || state.lockedMode) return state;
      return commit(state, { ...design, mode: action.mode });
    case 'undo':
      if (state.history.length === 0) return state;
      return { ...state, design: state.history[state.history.length - 1], history: state.history.slice(0, -1) };
    case 'reset': {
      // Back to this session's start (empty, in the challenge's rule) - undoable within the session.
      const to: Design = { mode: state.lockedMode ?? state.start.mode, pieces: state.start.pieces.map((piece) => ({ ...piece, cell: { ...piece.cell } })) };
      if (JSON.stringify(to) === JSON.stringify(design)) return state;
      return commit(state, to);
    }
    case 'begin':
      return startPlayground(challengeStart(action.challenge), action.challenge?.mode ?? null);
  }
}

/**
 * Three visual-matching challenges. Each shows a TARGET result; it is
 * solved when the player's result has exactly the same (cell, motif) set.
 * `mode` fixes the rule, or null lets the player choose it.
 */
export type Challenge = { id: string; mode: SymmetryMode | null; motifs: string[]; target: { cell: Cell; motifId: string }[] };
const marks = (motifId: string, cells: [number, number][]) => cells.map(([col, row]) => ({ cell: { col, row }, motifId }));
export const CHALLENGES: Challenge[] = [
  { id: 'twins', mode: 'mirror', motifs: ['muyuz', 'gul'], target: [...marks('muyuz', [[0, 1], [4, 1]]), ...marks('gul', [[2, 3]])] },
  { id: 'corners', mode: 'fourWay', motifs: ['kochkorMuyuz', 'gul'], target: [...marks('kochkorMuyuz', [[0, 0], [4, 0], [0, 4], [4, 4]]), ...marks('gul', [[2, 2]])] },
  { id: 'whichRule', mode: null, motifs: ['tortKulak', 'bulak', 'jalbyrak'], target: [...marks('tortKulak', [[1, 1], [3, 1], [1, 3], [3, 3]]), ...marks('bulak', [[2, 0], [2, 4]])] },
];

export function isSolved(challenge: Challenge, design: Design): boolean {
  if (challenge.mode && design.mode !== challenge.mode) return false;
  const want = new Set(challenge.target.map((mark) => `${cellKey(mark.cell)}|${mark.motifId}`));
  const have = resultSet(design);
  return want.size === have.size && [...want].every((key) => have.has(key));
}

/** Target cells the result is still missing, and result marks that aren't in the target (for gentle hints). */
export function compareToTarget(challenge: Challenge, design: Design): { missing: number; extra: number } {
  const want = new Set(challenge.target.map((mark) => `${cellKey(mark.cell)}|${mark.motifId}`));
  const have = resultSet(design);
  return { missing: [...want].filter((key) => !have.has(key)).length, extra: [...have].filter((key) => !want.has(key)).length };
}

/**
 * "Open in Creator": the SOURCE pieces as a brand-new, unsaved Creator
 * design (deep copy), with the playground's mode. The Creator mirrors them
 * the same way, so it shows the same result. No saved creation is touched.
 */
export function toCreatorCopy(design: Design, color: string): { state: OymoEditorState; symmetry: SymmetryMode } {
  const layers: MotifLayer[] = design.pieces.map((piece, index) => ({ id: `layer-${index}`, motifId: piece.motifId, color, point: centre(piece.cell), rotation: 0, scale: 1, visible: true }));
  return { state: JSON.parse(JSON.stringify({ layers, backgroundColor: '#EADCC0', nextId: layers.length })) as OymoEditorState, symmetry: design.mode };
}
