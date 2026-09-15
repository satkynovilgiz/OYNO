import type { KokBoruMatchOutcome, KokBoruPossession } from './KokBoruTypes';

export type Point = { x: number; z: number };

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

export type ResolvePossessionParams = {
  current: KokBoruPossession;
  playerPos: Point;
  aiPos: Point;
  objectPos: Point;
  /** True for `POSSESSION_COOLDOWN_S` after any possession change - stops
   * an immediate re-steal ping-pong the same tick positions update. */
  cooldownActive: boolean;
  pickupRadius: number;
  stealRadius: number;
};

/**
 * Pure per-tick possession resolution - no side effects, no timers of its
 * own (the caller owns the cooldown clock). Pickup and steal are both
 * automatic proximity (Section 5 groups player/AI under the same "when
 * close enough" condition, and the AI obviously has no button to press) -
 * unlike Phase A's player-only explicit "PICK UP" press, which practice
 * mode keeps unchanged (this engine is normal-mode/1v1 match only).
 * Never "teleports" possession - only ever changes based on actual
 * current distances.
 */
export function resolvePossession({ current, playerPos, aiPos, objectPos, cooldownActive, pickupRadius, stealRadius }: ResolvePossessionParams): KokBoruPossession {
  if (cooldownActive) return current;

  if (current === 'FREE') {
    const playerNear = distance(playerPos, objectPos) <= pickupRadius;
    const aiNear = distance(aiPos, objectPos) <= pickupRadius;
    if (!playerNear && !aiNear) return 'FREE';
    if (playerNear && aiNear) {
      // Both in range the same tick - whichever is literally closer gets
      // it, a deterministic tiebreak rather than a coin flip or a cheat
      // for either side.
      return distance(playerPos, objectPos) <= distance(aiPos, objectPos) ? 'PLAYER' : 'AI';
    }
    return playerNear ? 'PLAYER' : 'AI';
  }

  if (current === 'PLAYER') {
    return distance(aiPos, playerPos) <= stealRadius ? 'AI' : 'PLAYER';
  }

  // current === 'AI'
  return distance(playerPos, aiPos) <= stealRadius ? 'PLAYER' : 'AI';
}

/**
 * Pure goal check - returns which side just scored, or null. Deliberately
 * stateless: it has no memory of a goal it already reported, so the exact
 * same carry sitting in the same goal circle across two consecutive calls
 * WILL report a goal both times. Duplicate-goal prevention is the caller's
 * job (see KokBoruController.ts) - after a goal, positions are reset away
 * from both goal circles before this is called again, which is what
 * actually makes a second immediate call return null. This function only
 * ever answers "is the carrier in a goal circle right now".
 */
export function checkGoal(params: {
  possession: KokBoruPossession;
  playerPos: Point;
  aiPos: Point;
  playerGoal: Point;
  aiGoal: Point;
  goalRadius: number;
}): 'player' | 'ai' | null {
  const { possession, playerPos, aiPos, playerGoal, aiGoal, goalRadius } = params;
  if (possession === 'PLAYER' && distance(playerPos, playerGoal) <= goalRadius) return 'player';
  if (possession === 'AI' && distance(aiPos, aiGoal) <= goalRadius) return 'ai';
  return null;
}

export function resolveMatchOutcome(playerScore: number, aiScore: number): KokBoruMatchOutcome {
  if (playerScore === aiScore) return 'DRAW';
  return playerScore > aiScore ? 'WIN' : 'LOSS';
}
