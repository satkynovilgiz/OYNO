import type { MotifLayer, OymoEditorState } from '@/services/culture/oymoEditor';

import { PIECE_COLORS, rotationOrder, type Placement, type RestorePuzzle, type Rotation } from './restorePuzzles';

/**
 * Puzzle state and rules (pure). Tap-to-select / tap-to-place:
 *   tap a tray piece or a placed piece -> it is selected;
 *   tap a slot with a piece selected  -> it moves there (an occupant swaps
 *                                        back to where it came from);
 *   Turn -> the selected piece turns 90 degrees clockwise;
 *   Back to tray -> the selected placed piece returns.
 * Fixed slots never change. Undo restores the state before the LAST
 * change (one step); Reset restores the puzzle's start; Hint places one
 * missing piece correctly. Nothing here touches saved Oymo creations.
 */
export const BOARD_SLOTS = 9;

export type Piece = { id: string; motifId: Placement['motifId']; color: Placement['color']; rotation: Rotation };

export type Board = {
  /** Slot -> the piece in it (null = empty). Fixed slots hold their fixed piece. */
  slots: (Piece | null)[];
  tray: Piece[];
  selectedId: string | null;
};

export type PuzzleState = { puzzle: RestorePuzzle; board: Board; previous: Board | null; hintsUsed: number; moves: number };

const fixedSlots = (puzzle: RestorePuzzle) => new Set(puzzle.fixed.map((placement) => placement.slot));

export function startPuzzle(puzzle: RestorePuzzle): PuzzleState {
  const slots: (Piece | null)[] = Array.from({ length: BOARD_SLOTS }, () => null);
  for (const placement of puzzle.fixed) slots[placement.slot] = { id: `fixed-${placement.slot}`, motifId: placement.motifId, color: placement.color, rotation: placement.rotation };
  const tray = puzzle.target.map((placement, index) => ({ id: `piece-${index}`, motifId: placement.motifId, color: placement.color, rotation: puzzle.trayRotations[index] ?? 0 }));
  return { puzzle, board: { slots, tray, selectedId: null }, previous: null, hintsUsed: 0, moves: 0 };
}

/** The rotation as it LOOKS: 90 and 270 are the same for an order-2 motif, all four for order 4. */
export function visibleRotation(motifId: string, rotation: number): number {
  const step = 360 / rotationOrder(motifId);
  return ((rotation % step) + step) % step;
}

const key = (slot: number, piece: { motifId: string; color: string; rotation: number }) => `${slot}|${piece.motifId}|${piece.color}|${visibleRotation(piece.motifId, piece.rotation)}`;

/**
 * Solved = every slot holds what the target shows: same motif, same colour,
 * a rotation that LOOKS the same, nothing extra and nothing left over.
 * Which of two identical pieces went where doesn't matter.
 */
export function isSolved(state: Pick<PuzzleState, 'puzzle' | 'board'>): boolean {
  if (state.board.tray.length > 0) return false;
  const wanted = new Set([...state.puzzle.fixed, ...state.puzzle.target].map((placement) => key(placement.slot, placement)));
  const placed = state.board.slots.map((piece, slot) => (piece ? key(slot, piece) : null)).filter((value): value is string => !!value);
  return placed.length === wanted.size && placed.every((value) => wanted.has(value));
}

/** Correct slots right now (for progress text). */
export function correctCount(state: Pick<PuzzleState, 'puzzle' | 'board'>): number {
  const wanted = new Set(state.puzzle.target.map((placement) => key(placement.slot, placement)));
  return state.board.slots.filter((piece, slot) => piece && !piece.id.startsWith('fixed-') && wanted.has(key(slot, piece))).length;
}

export type PuzzleAction =
  | { type: 'select'; pieceId: string }
  | { type: 'slot'; slot: number }
  | { type: 'turn' }
  | { type: 'toTray' }
  | { type: 'hint' }
  | { type: 'undo' }
  | { type: 'reset' };

function locate(board: Board, pieceId: string): { where: 'tray' } | { where: 'slot'; slot: number } | null {
  if (board.tray.some((piece) => piece.id === pieceId)) return { where: 'tray' };
  const slot = board.slots.findIndex((piece) => piece?.id === pieceId);
  return slot >= 0 ? { where: 'slot', slot } : null;
}

/** A board change: remembered for one-step Undo. Unchanged boards don't count. */
function change(state: PuzzleState, board: Board): PuzzleState {
  if (board === state.board) return state;
  return { ...state, board, previous: { ...state.board, selectedId: null }, moves: state.moves + 1 };
}

export function puzzleReducer(state: PuzzleState, action: PuzzleAction): PuzzleState {
  const { board } = state;
  const fixed = fixedSlots(state.puzzle);
  const solved = isSolved(state);
  if (solved && action.type !== 'reset') return state; // solved boards stay as they are
  switch (action.type) {
    case 'select': {
      const at = locate(board, action.pieceId);
      if (!at || (at.where === 'slot' && fixed.has(at.slot))) return state;
      return { ...state, board: { ...board, selectedId: board.selectedId === action.pieceId ? null : action.pieceId } };
    }
    case 'slot': {
      if (action.slot < 0 || action.slot >= BOARD_SLOTS || fixed.has(action.slot)) return state;
      const occupant = board.slots[action.slot];
      if (!board.selectedId) return occupant ? { ...state, board: { ...board, selectedId: occupant.id } } : state;
      const at = locate(board, board.selectedId);
      if (!at) return state;
      const piece = at.where === 'tray' ? board.tray.find((item) => item.id === board.selectedId)! : board.slots[at.slot]!;
      if (at.where === 'slot' && at.slot === action.slot) return { ...state, board: { ...board, selectedId: null } };
      const slots = [...board.slots];
      let tray = board.tray;
      if (at.where === 'tray') {
        tray = tray.filter((item) => item.id !== piece.id);
        if (occupant) tray = [...tray, occupant]; // the occupant goes back to the tray
      } else {
        slots[at.slot] = occupant; // swap
      }
      slots[action.slot] = piece;
      return change(state, { slots, tray, selectedId: null });
    }
    case 'turn': {
      if (!board.selectedId) return state;
      const turn = (piece: Piece): Piece => ({ ...piece, rotation: (((piece.rotation + 90) % 360) as Rotation) });
      const at = locate(board, board.selectedId);
      if (!at) return state;
      if (at.where === 'tray') return change(state, { ...board, tray: board.tray.map((piece) => (piece.id === board.selectedId ? turn(piece) : piece)) });
      const slots = board.slots.map((piece, slot) => (slot === at.slot && piece ? turn(piece) : piece));
      return change(state, { ...board, slots });
    }
    case 'toTray': {
      if (!board.selectedId) return state;
      const at = locate(board, board.selectedId);
      if (!at || at.where !== 'slot') return state;
      const piece = board.slots[at.slot]!;
      return change(state, { slots: board.slots.map((item, slot) => (slot === at.slot ? null : item)), tray: [...board.tray, piece], selectedId: null });
    }
    case 'hint': {
      // One missing target placement, filled with a matching piece (from the tray or a wrong slot).
      const wanted = state.puzzle.target.find((placement) => {
        const piece = board.slots[placement.slot];
        return !piece || key(placement.slot, piece) !== key(placement.slot, placement);
      });
      if (!wanted) return state;
      const matches = (piece: Piece | null) => !!piece && piece.motifId === wanted.motifId && piece.color === wanted.color;
      const fromTray = board.tray.find(matches);
      const fromSlot = fromTray ? -1 : board.slots.findIndex((piece, slot) => !fixed.has(slot) && matches(piece) && key(slot, piece!) !== key(slot, state.puzzle.target.find((item) => item.slot === slot) ?? { motifId: '', color: '', rotation: 0 }));
      const source = fromTray ?? (fromSlot >= 0 ? board.slots[fromSlot]! : null);
      if (!source) return state;
      const placed: Piece = { ...source, rotation: wanted.rotation };
      const slots = [...board.slots];
      let tray = board.tray;
      const occupant = slots[wanted.slot];
      if (fromTray) tray = tray.filter((piece) => piece.id !== source.id);
      else slots[fromSlot] = null;
      if (occupant) tray = [...tray, occupant];
      slots[wanted.slot] = placed;
      return { ...change(state, { slots, tray, selectedId: null }), hintsUsed: state.hintsUsed + 1 };
    }
    case 'undo':
      return state.previous ? { ...state, board: state.previous, previous: null } : state;
    case 'reset':
      return startPuzzle(state.puzzle);
  }
}

/** The 300x300 Creator canvas: slot centres at 50 / 150 / 250. */
export const CANVAS = 300;
export const slotCenter = (slot: number) => ({ x: 50 + (slot % 3) * 100, y: 50 + Math.floor(slot / 3) * 100 });
const PIECE_SCALE = 2;

/**
 * The solved composition as a brand-new, UNSAVED Creator state - a deep
 * copy: editing it can never change the puzzle, and it is not linked to
 * any saved creation (it has no creation id; saving it creates a new one).
 */
export function toCreatorState(state: Pick<PuzzleState, 'board'>, backgroundColor = '#EADCC0'): OymoEditorState {
  const layers: MotifLayer[] = state.board.slots
    .map((piece, slot) => (piece ? { piece, slot } : null))
    .filter((entry): entry is { piece: Piece; slot: number } => !!entry)
    .map(({ piece, slot }, index) => ({ id: `layer${index}`, motifId: piece.motifId, color: PIECE_COLORS[piece.color], point: slotCenter(slot), rotation: piece.rotation, scale: PIECE_SCALE, visible: true }));
  return { layers: JSON.parse(JSON.stringify(layers)) as MotifLayer[], backgroundColor, nextId: layers.length };
}
