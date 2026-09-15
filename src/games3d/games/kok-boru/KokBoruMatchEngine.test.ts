import { checkGoal, resolveMatchOutcome, resolvePossession } from './KokBoruMatchEngine';

const FAR = { x: 100, z: 100 };
const ORIGIN = { x: 0, z: 0 };
const PLAYER_GOAL = { x: 0, z: -38 };
const AI_GOAL = { x: 0, z: 38 };

describe('KokBoruMatchEngine.resolvePossession', () => {
  it('picks up a free object for whichever side is in range', () => {
    expect(
      resolvePossession({ current: 'FREE', playerPos: { x: 0.5, z: 0 }, aiPos: FAR, objectPos: ORIGIN, cooldownActive: false, pickupRadius: 2, stealRadius: 2.6 }),
    ).toBe('PLAYER');

    expect(
      resolvePossession({ current: 'FREE', playerPos: FAR, aiPos: { x: 0.5, z: 0 }, objectPos: ORIGIN, cooldownActive: false, pickupRadius: 2, stealRadius: 2.6 }),
    ).toBe('AI');
  });

  it('stays FREE when nobody is close enough', () => {
    expect(resolvePossession({ current: 'FREE', playerPos: FAR, aiPos: FAR, objectPos: ORIGIN, cooldownActive: false, pickupRadius: 2, stealRadius: 2.6 })).toBe(
      'FREE',
    );
  });

  it('breaks a simultaneous-pickup tie in favor of whoever is literally closer, never a coin flip', () => {
    const result = resolvePossession({
      current: 'FREE',
      playerPos: { x: 0.5, z: 0 }, // 0.5m away
      aiPos: { x: 0, z: 1.5 }, // 1.5m away
      objectPos: ORIGIN,
      cooldownActive: false,
      pickupRadius: 2,
      stealRadius: 2.6,
    });
    expect(result).toBe('PLAYER');
  });

  it('steals from the player when the AI closes to within steal range', () => {
    const result = resolvePossession({
      current: 'PLAYER',
      playerPos: ORIGIN,
      aiPos: { x: 1, z: 0 },
      objectPos: ORIGIN,
      cooldownActive: false,
      pickupRadius: 2,
      stealRadius: 2.6,
    });
    expect(result).toBe('AI');
  });

  it('steals back from the AI when the player closes to within steal range', () => {
    const result = resolvePossession({
      current: 'AI',
      playerPos: { x: 1, z: 0 },
      aiPos: ORIGIN,
      objectPos: ORIGIN,
      cooldownActive: false,
      pickupRadius: 2,
      stealRadius: 2.6,
    });
    expect(result).toBe('PLAYER');
  });

  it('does not steal while the carrier and the challenger are far apart', () => {
    const result = resolvePossession({
      current: 'PLAYER',
      playerPos: ORIGIN,
      aiPos: FAR,
      objectPos: ORIGIN,
      cooldownActive: false,
      pickupRadius: 2,
      stealRadius: 2.6,
    });
    expect(result).toBe('PLAYER');
  });

  it('honors an active cooldown even when a steal would otherwise fire, preventing instant ping-pong', () => {
    const result = resolvePossession({
      current: 'PLAYER',
      playerPos: ORIGIN,
      aiPos: { x: 0.1, z: 0 },
      objectPos: ORIGIN,
      cooldownActive: true,
      pickupRadius: 2,
      stealRadius: 2.6,
    });
    expect(result).toBe('PLAYER');
  });
});

describe('KokBoruMatchEngine.checkGoal', () => {
  it('scores for the player when they carry it into their own goal circle', () => {
    const result = checkGoal({
      possession: 'PLAYER',
      playerPos: { x: 0, z: -38 },
      aiPos: FAR,
      playerGoal: PLAYER_GOAL,
      aiGoal: AI_GOAL,
      goalRadius: 2.8,
    });
    expect(result).toBe('player');
  });

  it('scores for the AI when it carries it into its own goal circle', () => {
    const result = checkGoal({
      possession: 'AI',
      playerPos: FAR,
      aiPos: { x: 0, z: 38 },
      playerGoal: PLAYER_GOAL,
      aiGoal: AI_GOAL,
      goalRadius: 2.8,
    });
    expect(result).toBe('ai');
  });

  it('does not score if the player merely passes through the AI`s goal (wrong goal for that side)', () => {
    const result = checkGoal({
      possession: 'PLAYER',
      playerPos: { x: 0, z: 38 },
      aiPos: FAR,
      playerGoal: PLAYER_GOAL,
      aiGoal: AI_GOAL,
      goalRadius: 2.8,
    });
    expect(result).toBeNull();
  });

  it('does not score while the object is FREE, even if it is sitting inside a goal circle', () => {
    const result = checkGoal({
      possession: 'FREE',
      playerPos: { x: 0, z: -38 },
      aiPos: FAR,
      playerGoal: PLAYER_GOAL,
      aiGoal: AI_GOAL,
      goalRadius: 2.8,
    });
    expect(result).toBeNull();
  });

  it('duplicate-goal prevention: the same carry sitting in the goal keeps reporting a goal (stateless check) - only the caller resetting positions away from the circle actually stops a second score', () => {
    const stillInGoal = { possession: 'PLAYER' as const, playerPos: { x: 0, z: -38 }, aiPos: FAR, playerGoal: PLAYER_GOAL, aiGoal: AI_GOAL, goalRadius: 2.8 };
    expect(checkGoal(stillInGoal)).toBe('player');
    expect(checkGoal(stillInGoal)).toBe('player'); // proves this function alone doesn't dedupe

    // What actually prevents a duplicate score in the real controller: it
    // resets the carrier's position (and possession to FREE) before the
    // next tick's checkGoal call - simulate that here.
    const afterReset = { ...stillInGoal, possession: 'FREE' as const, playerPos: { x: 0, z: 10 } };
    expect(checkGoal(afterReset)).toBeNull();
  });
});

describe('KokBoruMatchEngine.resolveMatchOutcome', () => {
  it('is a WIN when the player has more goals', () => {
    expect(resolveMatchOutcome(2, 1)).toBe('WIN');
  });

  it('is a LOSS when the AI has more goals', () => {
    expect(resolveMatchOutcome(1, 2)).toBe('LOSS');
  });

  it('is a DRAW when scores are equal, including 0-0', () => {
    expect(resolveMatchOutcome(1, 1)).toBe('DRAW');
    expect(resolveMatchOutcome(0, 0)).toBe('DRAW');
  });
});

describe('KokBoruMatchEngine statelessness (what makes "replay" a safe, complete reset)', () => {
  it('never remembers anything between calls - identical inputs always produce identical outputs regardless of call history, so KokBoruController.restart() only has to reset its own refs/state, not this module', () => {
    // Drive the engine through a full mini-match (pickup -> goal -> steal),
    // then call it again with the exact same "fresh match" inputs used at
    // the very start - if the module held any hidden state, this second
    // call would differ from the first.
    const freshMatchInputs = { current: 'FREE' as const, playerPos: { x: 0.5, z: 0 }, aiPos: FAR, objectPos: ORIGIN, cooldownActive: false, pickupRadius: 2, stealRadius: 2.6 };
    const firstCallResult = resolvePossession(freshMatchInputs);

    resolvePossession({ ...freshMatchInputs, current: 'PLAYER', aiPos: { x: 1, z: 0 } }); // simulate a steal happening
    checkGoal({ possession: 'AI', playerPos: FAR, aiPos: AI_GOAL, playerGoal: PLAYER_GOAL, aiGoal: AI_GOAL, goalRadius: 2.8 }); // simulate a goal happening
    resolveMatchOutcome(5, 3); // simulate a match ending

    const secondCallResult = resolvePossession(freshMatchInputs);
    expect(secondCallResult).toBe(firstCallResult);
  });
});
