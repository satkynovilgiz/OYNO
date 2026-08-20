import {
  applyCatch,
  BESH_TASH_STAGES,
  createInitialState,
  forceFail,
  isLegalCatch,
  startGame,
  TOTAL_STONES,
} from './index';

describe('Besh Tash — createInitialState / startGame', () => {
  it('starts with 1 stone held and the rest on the ground', () => {
    const state = createInitialState();
    expect(state.stonesHeld).toBe(1);
    expect(state.stonesOnGround).toBe(TOTAL_STONES - 1);
    expect(state.status).toBe('idle');
  });

  it('startGame moves status to in-progress', () => {
    const state = startGame(createInitialState());
    expect(state.status).toBe('in-progress');
    expect(state.currentStageIndex).toBe(0);
  });
});

describe('Besh Tash — legal move validation', () => {
  it('accepts a catch matching the active stage grabCount', () => {
    const state = startGame(createInitialState());
    expect(isLegalCatch(state, BESH_TASH_STAGES[0].grabCount)).toBe(true);
  });

  it('rejects a catch with the wrong grabbed count', () => {
    const state = startGame(createInitialState());
    expect(isLegalCatch(state, BESH_TASH_STAGES[0].grabCount + 1)).toBe(false);
  });

  it('rejects any catch once the game is not in-progress', () => {
    const state = createInitialState(); // status: 'idle'
    expect(isLegalCatch(state, BESH_TASH_STAGES[0].grabCount)).toBe(false);
  });
});

describe('Besh Tash — stage progression', () => {
  it('advances through all 5 stages to a win on 4 correct one-stone catches', () => {
    let state = startGame(createInitialState());

    for (let i = 0; i < BESH_TASH_STAGES.length - 1; i++) {
      const stage = BESH_TASH_STAGES[i];
      const { state: nextState, result } = applyCatch(state, stage.grabCount, true);
      expect(result.type).toBe('stage-cleared');
      expect(nextState.stonesHeld).toBe(stage.heldAfter);
      state = nextState;
    }

    // Final flourish stage (grabCount: 0) completes the win.
    const finalStage = BESH_TASH_STAGES[BESH_TASH_STAGES.length - 1];
    const { state: wonState, result } = applyCatch(state, finalStage.grabCount, true);
    expect(result.type).toBe('game-won');
    expect(wonState.status).toBe('won');
    expect(wonState.stonesHeld).toBe(TOTAL_STONES);
    expect(wonState.stonesOnGround).toBe(0);
  });
});

describe('Besh Tash — win condition detection', () => {
  it('reports game-won only after the flourish stage, not earlier', () => {
    let state = startGame(createInitialState());
    for (let i = 0; i < BESH_TASH_STAGES.length - 1; i++) {
      const { state: nextState, result } = applyCatch(state, BESH_TASH_STAGES[i].grabCount, true);
      expect(result.type).not.toBe('game-won');
      state = nextState;
    }
    expect(state.status).toBe('in-progress');
  });
});

describe('Besh Tash — edge case: dropping the catch fails the run', () => {
  it('fails immediately on a dropped catch, even mid-progression', () => {
    let state = startGame(createInitialState());
    // Clear stage 1 legitimately first.
    ({ state } = applyCatch(state, BESH_TASH_STAGES[0].grabCount, true));

    // Now fail stage 2 by dropping the catch.
    const { state: failedState, result } = applyCatch(state, BESH_TASH_STAGES[1].grabCount, false);
    expect(result).toEqual({ type: 'game-failed', reason: 'dropped-catch' });
    expect(failedState.status).toBe('failed');
    expect(failedState.lastFoul).toBe('dropped-catch');
  });

  it('fails on a mis-counted grab even if the catch itself succeeded', () => {
    const state = startGame(createInitialState());
    const wrongCount = BESH_TASH_STAGES[0].grabCount + 1;
    const { result } = applyCatch(state, wrongCount, true);
    expect(result).toEqual({ type: 'game-failed', reason: 'dropped-catch' });
  });
});

describe('Besh Tash — UI-detected fouls', () => {
  it('forceFail fails the game with the given reason (e.g. second-hand-used)', () => {
    const state = startGame(createInitialState());
    const { state: failedState, result } = forceFail(state, 'second-hand-used');
    expect(failedState.status).toBe('failed');
    expect(result).toEqual({ type: 'game-failed', reason: 'second-hand-used' });
  });
});

describe('Besh Tash — applyCatch guards', () => {
  it('throws if called while the game is not in-progress', () => {
    const state = createInitialState();
    expect(() => applyCatch(state, 1, true)).toThrow();
  });
});
