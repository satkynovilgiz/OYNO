import { cellKey, GRID, playgroundReducer, startPlayground, type Design, type PlaygroundAction, type PlaygroundState } from './playgroundModel';
import { rememberReducer, startRemember, validatePattern, type Level, type Mark, type RememberAction, type RememberPattern, type RememberState, type ViewTime } from './rememberModel';

/**
 * Remember the Pattern, two players on one device. Player A makes a small
 * pattern on the playground grid; the device is passed (the reference is
 * NOT on screen); Player B taps Ready, looks, hides it and rebuilds it with
 * the solo game's own rules (rememberReducer: Show again = assisted,
 * matching on (cell, motif)). Then roles can be swapped. Names are
 * optional, nothing is stored, no score is kept between rounds.
 */
export const MIN_PIECES = 3;
export const MAX_PIECES = 7;
/** The motifs players can use (the same set the solo game draws on). */
export const TOGETHER_MOTIFS = ['gul', 'muyuz', 'bulak', 'jalbyrak', 'tortKulak', 'kochkorMuyuz'] as const;
export const NAME_MAX = 20;

export type Role = 'a' | 'b';
export type Players = { a: string; b: string };

export type TogetherState =
  | { phase: 'setup'; players: Players; viewTime: ViewTime; author: Role }
  /** The author builds; `editor` is theirs alone. */
  | { phase: 'authoring'; players: Players; viewTime: ViewTime; author: Role; editor: PlaygroundState; problems: Problem[] }
  /** Privacy screen: the reference exists but is not shown until the other player taps Ready. */
  | { phase: 'pass'; players: Players; viewTime: ViewTime; author: Role; reference: RememberPattern }
  /** The other player's attempt (the solo game's state). */
  | { phase: 'attempt'; players: Players; viewTime: ViewTime; author: Role; reference: RememberPattern; attempt: RememberState };

export type Problem = 'tooFew' | 'tooMany' | 'unsupportedMotif' | 'outsideGrid' | 'sharedCell';

export const START_TOGETHER: TogetherState = { phase: 'setup', players: { a: '', b: '' }, viewTime: null, author: 'a' };
export const other = (role: Role): Role => (role === 'a' ? 'b' : 'a');
const cleanName = (name: string) => name.replace(/[<>{}\n\r\t]/g, '').slice(0, NAME_MAX);

const levelFor = (count: number): Level => (count <= 3 ? 'easy' : count <= 5 ? 'medium' : 'hard');

/** Why a pattern can't be used yet (empty = valid). Uses the solo game's own integrity check, plus the 3-7 bound and supported motifs. */
export function validateDesign(design: Design): Problem[] {
  const problems = new Set<Problem>();
  if (design.pieces.length < MIN_PIECES) problems.add('tooFew');
  if (design.pieces.length > MAX_PIECES) problems.add('tooMany');
  if (design.pieces.some((piece) => !(TOGETHER_MOTIFS as readonly string[]).includes(piece.motifId))) problems.add('unsupportedMotif');
  const integrity = validatePattern({ id: 'together', level: levelFor(design.pieces.length), marks: design.pieces.map((piece) => ({ cell: piece.cell, motifId: piece.motifId })) });
  if (integrity.some((problem) => problem.includes('outside'))) problems.add('outsideGrid');
  if (integrity.some((problem) => problem.includes('two motifs'))) problems.add('sharedCell');
  return [...problems];
}

/** A DEEP copy of the author's pieces as a Remember pattern - the attempt can never reach the author's editor or this reference. */
export function toReference(design: Design): RememberPattern {
  const marks: Mark[] = design.pieces.map((piece) => ({ cell: { col: piece.cell.col, row: piece.cell.row }, motifId: piece.motifId }));
  return { id: 'together', level: levelFor(marks.length), marks };
}

/** The motifs offered to the rebuilding player: every motif of the reference, plus the rest of the set (all supported motifs). */
export const rebuildMotifs = (): string[] => [...TOGETHER_MOTIFS];

export type TogetherAction =
  | { type: 'name'; role: Role; name: string }
  | { type: 'viewTime'; viewTime: ViewTime }
  | { type: 'begin' }
  | { type: 'author'; action: PlaygroundAction }
  | { type: 'pass' }
  | { type: 'ready' }
  | { type: 'play'; action: RememberAction }
  /** The same reference again, a fresh attempt (back to the privacy screen). */
  | { type: 'retry' }
  /** The other player authors next: empty editor, no reference, no attempt. */
  | { type: 'swap' }
  | { type: 'newGame' };

const freshEditor = () => startPlayground({ pieces: [], mode: 'none' }, 'none');

export function togetherReducer(state: TogetherState, action: TogetherAction): TogetherState {
  switch (action.type) {
    case 'name':
      return state.phase === 'setup' ? { ...state, players: { ...state.players, [action.role]: cleanName(action.name) } } : state;
    case 'viewTime':
      return state.phase === 'setup' ? { ...state, viewTime: action.viewTime } : state;
    case 'begin':
      return state.phase === 'setup' ? { phase: 'authoring', players: state.players, viewTime: state.viewTime, author: state.author, editor: freshEditor(), problems: [] } : state;
    case 'author': {
      if (state.phase !== 'authoring' || action.action.type === 'mode' || action.action.type === 'begin') return state;
      // Over the limit: a place is refused (nothing changes), the rest of the editor works as usual.
      if (action.action.type === 'place' && state.editor.design.pieces.length >= MAX_PIECES) return { ...state, problems: ['tooMany'] };
      const editor = playgroundReducer(state.editor, action.action);
      return editor === state.editor ? state : { ...state, editor, problems: [] };
    }
    case 'pass': {
      if (state.phase !== 'authoring') return state;
      const problems = validateDesign(state.editor.design);
      if (problems.length) return { ...state, problems };
      return { phase: 'pass', players: state.players, viewTime: state.viewTime, author: state.author, reference: toReference(state.editor.design) };
    }
    case 'ready':
      // Only an explicit tap by the other player starts viewing.
      return state.phase === 'pass' ? { ...state, phase: 'attempt', attempt: startRemember(state.reference, state.viewTime) } : state;
    case 'play': {
      if (state.phase !== 'attempt' || action.action.type === 'restart') return state;
      const attempt = rememberReducer(state.attempt, action.action);
      return attempt === state.attempt ? state : { ...state, attempt };
    }
    case 'retry':
      return state.phase === 'attempt' ? { phase: 'pass', players: state.players, viewTime: state.viewTime, author: state.author, reference: state.reference } : state;
    case 'swap':
      return state.phase === 'attempt' && state.attempt.phase === 'done' ? { phase: 'authoring', players: state.players, viewTime: state.viewTime, author: other(state.author), editor: freshEditor(), problems: [] } : state;
    case 'newGame':
      return { ...START_TOGETHER, players: state.players, viewTime: state.viewTime };
  }
}

/** "Player A" / the given name. */
export const displayName = (players: Players, role: Role, fallback: (role: Role) => string) => players[role].trim() || fallback(role);

/** Every cell of the grid (for the solvability check). */
export const ALL_CELLS = Array.from({ length: GRID * GRID }, (_, index) => ({ col: index % GRID, row: Math.floor(index / GRID) }));
export { cellKey };
