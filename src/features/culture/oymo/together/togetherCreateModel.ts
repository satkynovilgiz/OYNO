import { addLayer, EMPTY_OYMO_STATE, MAX_OYMO_LAYERS, type OymoEditorState } from '@/services/culture/oymoEditor';
import type { SymmetryMode } from '@/services/culture/symmetry';

/**
 * Create Together - two people, one device, one Oymo design. Turns change
 * only by explicit taps (Pass the device -> the other person starts their
 * turn); nothing is timed or scored. Undo works WITHIN the current turn
 * only: it can never reach back into the other player's turn. Edits use the
 * Creator's own editor functions, so its layer limit applies. Ephemeral:
 * nothing is stored until the design is opened in the Creator and saved there.
 */
export type Player = 'a' | 'b';
export const TURN_CHOICES = [2, 4, 6, null] as const; // null = free creation
export type TurnLimit = (typeof TURN_CHOICES)[number];
export const NAME_MAX = 20;

export type TogetherState =
  | { phase: 'setup'; names: { a: string; b: string }; turnLimit: TurnLimit }
  | { phase: 'turn'; names: { a: string; b: string }; turnLimit: TurnLimit; turn: number; player: Player; design: OymoEditorState; symmetry: SymmetryMode; turnStart: OymoEditorState; history: OymoEditorState[]; confirmReset: boolean }
  /** Between turns: the design is kept, nothing can be edited until the next player starts. */
  | { phase: 'pass'; names: { a: string; b: string }; turnLimit: TurnLimit; turn: number; next: Player; design: OymoEditorState; symmetry: SymmetryMode }
  | { phase: 'finish'; names: { a: string; b: string }; turns: number; design: OymoEditorState; symmetry: SymmetryMode };

export const START: TogetherState = { phase: 'setup', names: { a: '', b: '' }, turnLimit: 4 };
export const other = (player: Player): Player => (player === 'a' ? 'b' : 'a');
const copy = (state: OymoEditorState): OymoEditorState => ({ layers: state.layers.map((layer) => ({ ...layer, point: { ...layer.point } })), backgroundColor: state.backgroundColor, nextId: state.nextId });
const cleanName = (value: string) => value.replace(/[<>{}\n\r\t]/g, '').slice(0, NAME_MAX);

export type TogetherAction =
  | { type: 'name'; player: Player; name: string }
  | { type: 'turnLimit'; turnLimit: TurnLimit }
  | { type: 'begin'; symmetry?: SymmetryMode }
  /** One editor change, made with the Creator's own functions. */
  | { type: 'edit'; change: (state: OymoEditorState) => OymoEditorState }
  | { type: 'symmetry'; symmetry: SymmetryMode }
  | { type: 'undo' }
  | { type: 'pass' }
  | { type: 'startTurn' }
  | { type: 'finish' }
  | { type: 'askReset' }
  | { type: 'cancelReset' }
  | { type: 'confirmReset' }
  /** After finishing: back to setup (names and turn choice kept, design cleared). */
  | { type: 'newSession' };

export function togetherReducer(state: TogetherState, action: TogetherAction): TogetherState {
  switch (action.type) {
    case 'name':
      return state.phase === 'setup' ? { ...state, names: { ...state.names, [action.player]: cleanName(action.name) } } : state;
    case 'turnLimit':
      return state.phase === 'setup' ? { ...state, turnLimit: action.turnLimit } : state;
    case 'begin':
      if (state.phase !== 'setup') return state;
      return { phase: 'turn', names: state.names, turnLimit: state.turnLimit, turn: 1, player: 'a', design: copy(EMPTY_OYMO_STATE), symmetry: action.symmetry ?? 'mirror', turnStart: copy(EMPTY_OYMO_STATE), history: [], confirmReset: false };
    case 'edit': {
      if (state.phase !== 'turn') return state;
      const next = action.change(state.design);
      if (next === state.design) return state; // e.g. the layer limit was reached
      return { ...state, design: next, history: [...state.history, state.design], confirmReset: false };
    }
    case 'symmetry':
      return state.phase === 'turn' && state.symmetry !== action.symmetry ? { ...state, symmetry: action.symmetry } : state;
    case 'undo':
      // Only this turn's own steps; the turn's starting design is the floor.
      if (state.phase !== 'turn' || state.history.length === 0) return state;
      return { ...state, design: state.history[state.history.length - 1], history: state.history.slice(0, -1) };
    case 'pass': {
      if (state.phase !== 'turn') return state;
      if (state.turnLimit !== null && state.turn >= state.turnLimit) return { phase: 'finish', names: state.names, turns: state.turn, design: state.design, symmetry: state.symmetry };
      return { phase: 'pass', names: state.names, turnLimit: state.turnLimit, turn: state.turn, next: other(state.player), design: state.design, symmetry: state.symmetry };
    }
    case 'startTurn':
      // Only an explicit tap by the next player starts their turn.
      return state.phase === 'pass' ? { phase: 'turn', names: state.names, turnLimit: state.turnLimit, turn: state.turn + 1, player: state.next, design: state.design, symmetry: state.symmetry, turnStart: state.design, history: [], confirmReset: false } : state;
    case 'finish':
      if (state.phase === 'turn' || state.phase === 'pass') return { phase: 'finish', names: state.names, turns: state.turn, design: state.design, symmetry: state.symmetry };
      return state;
    case 'askReset':
      return state.phase === 'turn' && state.design.layers.length > 0 ? { ...state, confirmReset: true } : state;
    case 'cancelReset':
      return state.phase === 'turn' ? { ...state, confirmReset: false } : state;
    case 'confirmReset':
      // The whole shared design - both players' turns - only after confirmation. Undo can bring it back within this turn.
      return state.phase === 'turn' && state.confirmReset ? { ...state, design: copy(EMPTY_OYMO_STATE), history: [...state.history, state.design], confirmReset: false } : state;
    case 'newSession':
      return state.phase === 'finish' ? { phase: 'setup', names: state.names, turnLimit: 4 } : state;
  }
}

/** Place a motif with the Creator's own addLayer (which enforces MAX_OYMO_LAYERS). */
export const placeMotif = (point: { x: number; y: number }, motifId: string, color: string) => (state: OymoEditorState) => addLayer(state, point, motifId, color);
export const atLimit = (state: OymoEditorState) => state.layers.length >= MAX_OYMO_LAYERS;

/** The final design as an independent copy for the Creator (no player names in it). */
export const finalDesign = (state: Extract<TogetherState, { phase: 'finish' }>) => ({ state: copy(state.design), symmetry: state.symmetry });
