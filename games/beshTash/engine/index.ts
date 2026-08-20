/**
 * Pure game logic for Беш таш. No UI/React dependencies — see ../RULES.md
 * for the sourced rule this implements, and ../screens for the renderer.
 *
 * The traditional "single hand only" rule is naturally satisfied by a
 * single-touch gesture input model on a phone; `second-hand-used` exists
 * for a multi-touch UI that wants to explicitly detect and penalize a
 * second finger touching the play area.
 */
import type { BeshTashFoulReason, BeshTashGameState, BeshTashMoveResult, BeshTashStage } from '../types';

export const TOTAL_STONES = 5;

export const BESH_TASH_STAGES: readonly BeshTashStage[] = [
  { id: 1, heldBefore: 1, grabCount: 1, heldAfter: 2, isFlourish: false },
  { id: 2, heldBefore: 2, grabCount: 1, heldAfter: 3, isFlourish: false },
  { id: 3, heldBefore: 3, grabCount: 1, heldAfter: 4, isFlourish: false },
  { id: 4, heldBefore: 4, grabCount: 1, heldAfter: 5, isFlourish: false },
  { id: 5, heldBefore: 5, grabCount: 0, heldAfter: 5, isFlourish: true },
];

export function createInitialState(): BeshTashGameState {
  return {
    status: 'idle',
    currentStageIndex: 0,
    stonesOnGround: TOTAL_STONES - 1,
    stonesHeld: 1,
    attemptsUsed: 0,
    lastFoul: null,
  };
}

export function startGame(state: BeshTashGameState): BeshTashGameState {
  return { ...createInitialState(), status: 'in-progress' };
}

export function getActiveStage(state: BeshTashGameState): BeshTashStage | undefined {
  return BESH_TASH_STAGES[state.currentStageIndex];
}

export function isGameOver(state: BeshTashGameState): boolean {
  return state.status === 'won' || state.status === 'failed';
}

/** Whether a completed catch of `grabbedCount` stones is legal for the current stage. */
export function isLegalCatch(state: BeshTashGameState, grabbedCount: number): boolean {
  const stage = getActiveStage(state);
  if (!stage || state.status !== 'in-progress') return false;
  return grabbedCount === stage.grabCount;
}

/**
 * Apply a completed catch attempt (the player tossed their held stones,
 * grabbed `grabbedCount` from the ground, and either caught everything or
 * didn't). Returns the resulting state plus a discriminated result the UI
 * can react to (advance the stage animation, show a win screen, etc).
 */
export function applyCatch(
  state: BeshTashGameState,
  grabbedCount: number,
  caughtEverything: boolean,
): { state: BeshTashGameState; result: BeshTashMoveResult } {
  if (state.status !== 'in-progress') {
    throw new Error('applyCatch called while the game is not in progress');
  }
  const stage = getActiveStage(state);
  if (!stage) {
    throw new Error('applyCatch called with no active stage');
  }

  if (!caughtEverything || grabbedCount !== stage.grabCount) {
    return forceFail(state, 'dropped-catch');
  }

  const nextIndex = state.currentStageIndex + 1;
  const isLastStage = nextIndex >= BESH_TASH_STAGES.length;

  const nextState: BeshTashGameState = {
    ...state,
    stonesHeld: stage.heldAfter,
    stonesOnGround: state.stonesOnGround - stage.grabCount,
    currentStageIndex: nextIndex,
    attemptsUsed: state.attemptsUsed + 1,
    status: isLastStage ? 'won' : 'in-progress',
    lastFoul: null,
  };

  const result: BeshTashMoveResult = isLastStage
    ? { type: 'game-won', attemptsUsed: nextState.attemptsUsed }
    : { type: 'stage-cleared', nextStageIndex: nextIndex };

  return { state: nextState, result };
}

/** UI-detected fouls that aren't a simple wrong-count catch (e.g. touched a
 * stone it shouldn't have, or a second hand entered the play area). */
export function forceFail(
  state: BeshTashGameState,
  reason: BeshTashFoulReason,
): { state: BeshTashGameState; result: BeshTashMoveResult } {
  const nextState: BeshTashGameState = { ...state, status: 'failed', lastFoul: reason };
  return { state: nextState, result: { type: 'game-failed', reason } };
}

export function restartGame(): BeshTashGameState {
  return startGame(createInitialState());
}
