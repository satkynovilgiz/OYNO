/**
 * Pure game logic for Тогуз коргоол. No UI/React dependencies - see
 * ../RULES.md for the sourced rules this implements, and its UNVERIFIED
 * notes for what this engine deliberately does NOT encode as fact:
 *   - the "declare tuz at exactly 3 stones" threshold (Kazakh-sourced only,
 *     not confirmed for the Kyrgyz game) - this engine has no stone-count
 *     requirement to declare a tuz, only the ownership/ооз/collision rules
 *     RULES.md does state explicitly.
 *   - the standard mancala "starvation sweep" end condition - this engine
 *     reports `no-legal-moves` as a distinct, non-terminal-winner state
 *     rather than inventing who the remaining board stones go to.
 *
 * Also undocumented in RULES.md and decided here pragmatically (flagged so
 * a reviewer can correct it): if the sowing lap's last stone lands in a tuz
 * pit, only the tuz capture applies - the separate "last stone / even count"
 * capture rule is skipped for that pit, since a tuz pit's count never
 * accumulates (every stone landing there is swept away immediately, so
 * "the pit's new total" doesn't meaningfully exist to check for evenness).
 */
import {
  PITS_PER_ROW,
  TOTAL_PITS,
  STARTING_STONES_PER_PIT,
  WINNING_KAZAN_COUNT,
  type PlayerId,
  type ToguzKorgoolGameState,
  type ToguzKorgoolMoveResult,
} from '../types';

export function createInitialState(): ToguzKorgoolGameState {
  return {
    status: 'idle',
    pits: new Array(TOTAL_PITS).fill(STARTING_STONES_PER_PIT),
    kazans: [0, 0],
    tuz: [null, null],
    currentPlayer: 0,
    winner: null,
  };
}

export function startGame(state: ToguzKorgoolGameState): ToguzKorgoolGameState {
  return { ...createInitialState(), status: 'in-progress' };
}

export function isGameOver(state: ToguzKorgoolGameState): boolean {
  return state.status === 'won' || state.status === 'no-legal-moves';
}

function rowRange(player: PlayerId): [number, number] {
  return player === 0 ? [0, PITS_PER_ROW - 1] : [PITS_PER_ROW, TOTAL_PITS - 1];
}

export function pitOwner(pitIndex: number): PlayerId {
  return pitIndex < PITS_PER_ROW ? 0 : 1;
}

/** The "ооз" pit - closest to a player's own kazan, can never be tuz. */
export function oozPit(player: PlayerId): number {
  const [, end] = rowRange(player);
  return end;
}

function localPosition(pitIndex: number): number {
  return pitIndex % PITS_PER_ROW;
}

export function isLegalMove(state: ToguzKorgoolGameState, player: PlayerId, pitIndex: number): boolean {
  if (state.status !== 'in-progress' || state.currentPlayer !== player) return false;
  if (pitIndex < 0 || pitIndex >= TOTAL_PITS) return false;
  if (pitOwner(pitIndex) !== player) return false;
  return state.pits[pitIndex] > 0;
}

export function hasLegalMove(state: ToguzKorgoolGameState, player: PlayerId): boolean {
  const [start, end] = rowRange(player);
  for (let i = start; i <= end; i++) {
    if (state.pits[i] > 0) return true;
  }
  return false;
}

/** Whether `player` may declare `pitIndex` (one of their own pits) as tuz. */
export function canDeclareTuz(state: ToguzKorgoolGameState, player: PlayerId, pitIndex: number): boolean {
  if (state.status !== 'in-progress') return false;
  if (pitOwner(pitIndex) !== player) return false;
  if (state.tuz[player] !== null) return false; // only one tuz per player, ever
  if (pitIndex === oozPit(player)) return false; // ооз can never be tuz

  const opponent: PlayerId = player === 0 ? 1 : 0;
  const opponentTuz = state.tuz[opponent];
  if (opponentTuz !== null && localPosition(opponentTuz) === localPosition(pitIndex)) {
    return false; // can't mirror the opponent's declared tuz position
  }
  return true;
}

export function declareTuz(state: ToguzKorgoolGameState, player: PlayerId, pitIndex: number): ToguzKorgoolGameState {
  if (!canDeclareTuz(state, player, pitIndex)) {
    throw new Error('declareTuz called with an illegal tuz declaration');
  }
  const tuz: [number | null, number | null] = [...state.tuz];
  tuz[player] = pitIndex;
  return { ...state, tuz };
}

/**
 * Sow all stones from `pitIndex` (must belong to the current player and be
 * non-empty) one at a time into consecutive pits, applying tuz capture
 * per-stone and the even-count end-of-sow capture rule, then switches turn.
 */
export function applyMove(
  state: ToguzKorgoolGameState,
  pitIndex: number,
): { state: ToguzKorgoolGameState; result: ToguzKorgoolMoveResult } {
  const sower = state.currentPlayer;
  if (!isLegalMove(state, sower, pitIndex)) {
    throw new Error('applyMove called with an illegal move');
  }

  const pits = [...state.pits];
  const kazans: [number, number] = [...state.kazans];
  let stonesToSow = pits[pitIndex];
  pits[pitIndex] = 0;

  let index = pitIndex;
  let lastLandingPit = pitIndex;
  let lastLandedInTuz = false;

  while (stonesToSow > 0) {
    index = (index + 1) % TOTAL_PITS;
    lastLandingPit = index;

    const tuzOwner: PlayerId | null = state.tuz[0] === index ? 0 : state.tuz[1] === index ? 1 : null;
    if (tuzOwner !== null) {
      kazans[tuzOwner] += 1;
      lastLandedInTuz = true;
    } else {
      pits[index] += 1;
      lastLandedInTuz = false;
    }
    stonesToSow -= 1;
  }

  let captured = 0;
  if (!lastLandedInTuz && pitOwner(lastLandingPit) !== sower) {
    const finalCount = pits[lastLandingPit];
    if (finalCount > 0 && finalCount % 2 === 0) {
      captured = finalCount;
      kazans[sower] += finalCount;
      pits[lastLandingPit] = 0;
    }
  }

  const nextPlayer: PlayerId = sower === 0 ? 1 : 0;
  let nextState: ToguzKorgoolGameState = {
    ...state,
    pits,
    kazans,
    currentPlayer: nextPlayer,
  };

  if (kazans[sower] >= WINNING_KAZAN_COUNT) {
    nextState = { ...nextState, status: 'won', winner: sower };
    return { state: nextState, result: { type: 'game-won', winner: sower, kazanCount: kazans[sower] } };
  }

  if (!hasLegalMove(nextState, nextPlayer)) {
    nextState = { ...nextState, status: 'no-legal-moves' };
    return { state: nextState, result: { type: 'no-legal-moves', player: nextPlayer } };
  }

  return { state: nextState, result: { type: 'move-applied', sower, captured } };
}

export function restartGame(): ToguzKorgoolGameState {
  return startGame(createInitialState());
}
