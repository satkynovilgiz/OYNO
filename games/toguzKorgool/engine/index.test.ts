import type { ToguzKorgoolGameState } from '../types';
import { TOTAL_PITS } from '../types';
import {
  applyMove,
  canDeclareTuz,
  createInitialState,
  declareTuz,
  hasLegalMove,
  isLegalMove,
  oozPit,
  pitOwner,
  startGame,
} from './index';

function emptyBoardState(overrides: Partial<ToguzKorgoolGameState> = {}): ToguzKorgoolGameState {
  return {
    status: 'in-progress',
    pits: new Array(TOTAL_PITS).fill(0),
    kazans: [0, 0],
    tuz: [null, null],
    currentPlayer: 0,
    winner: null,
    ...overrides,
  };
}

describe('Toguz Korgool — createInitialState / startGame', () => {
  it('starts with 9 stones in each of the 18 pits (162 total)', () => {
    const state = createInitialState();
    expect(state.pits).toHaveLength(18);
    expect(state.pits.every((count) => count === 9)).toBe(true);
    expect(state.pits.reduce((sum, count) => sum + count, 0)).toBe(162);
    expect(state.kazans).toEqual([0, 0]);
    expect(state.status).toBe('idle');
  });

  it('startGame moves status to in-progress with player 0 to move', () => {
    const state = startGame(createInitialState());
    expect(state.status).toBe('in-progress');
    expect(state.currentPlayer).toBe(0);
  });
});

describe('Toguz Korgool — pit ownership', () => {
  it('assigns pits 0-8 to player 0 and 9-17 to player 1', () => {
    expect(pitOwner(0)).toBe(0);
    expect(pitOwner(8)).toBe(0);
    expect(pitOwner(9)).toBe(1);
    expect(pitOwner(17)).toBe(1);
  });

  it('the ооз pit is the last pit in each player\'s row', () => {
    expect(oozPit(0)).toBe(8);
    expect(oozPit(1)).toBe(17);
  });
});

describe('Toguz Korgool — legal move validation', () => {
  it('accepts sowing from a non-empty pit belonging to the player to move', () => {
    const state = startGame(createInitialState());
    expect(isLegalMove(state, 0, 0)).toBe(true);
  });

  it('rejects sowing from an empty pit', () => {
    const state = emptyBoardState({ pits: [0, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9] });
    expect(isLegalMove(state, 0, 0)).toBe(false);
  });

  it("rejects sowing from the opponent's pit", () => {
    const state = startGame(createInitialState());
    expect(isLegalMove(state, 0, 9)).toBe(false);
  });

  it("rejects a move made by the player who isn't the one to move", () => {
    const state = startGame(createInitialState());
    expect(state.currentPlayer).toBe(0);
    expect(isLegalMove(state, 1, 9)).toBe(false);
  });

  it('rejects any move once the game is not in-progress', () => {
    const state = createInitialState(); // status: 'idle'
    expect(isLegalMove(state, 0, 0)).toBe(false);
  });
});

describe('Toguz Korgool — sowing mechanics', () => {
  it('distributes one stone per pit into consecutive pits, emptying the source pit', () => {
    const state = startGame(createInitialState());
    const { state: next } = applyMove(state, 0);
    // 9 stones from pit 0 land at pits 1-8 (own row) and pit 9 (opponent's row).
    expect(next.pits[0]).toBe(0);
    for (let i = 1; i <= 8; i++) {
      expect(next.pits[i]).toBe(10);
    }
  });

  it('switches the turn to the other player after a move', () => {
    const state = startGame(createInitialState());
    const { state: next } = applyMove(state, 0);
    expect(next.currentPlayer).toBe(1);
  });

  it('wraps sowing from the end of the board back to pit 0', () => {
    // Pit 17 (player 1's ооз) has 3 stones; sowing wraps past 17 to 0, 1, 2.
    const state = emptyBoardState({ pits: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3], currentPlayer: 1 });
    const { state: next } = applyMove(state, 17);
    expect(next.pits[0]).toBe(1);
    expect(next.pits[1]).toBe(1);
    expect(next.pits[2]).toBe(1);
  });
});

describe('Toguz Korgool — capture rule', () => {
  it("captures all stones when the last sown stone lands in an opponent's pit making it even", () => {
    const state = startGame(createInitialState());
    // Pit 0 (player 0) has 9 stones -> lands at pits 1..9; pit 9 (player 1) goes 9 -> 10 (even).
    const { state: next, result } = applyMove(state, 0);
    expect(next.pits[9]).toBe(0);
    expect(next.kazans[0]).toBe(10);
    expect(result).toEqual({ type: 'move-applied', sower: 0, captured: 10 });
  });

  it("does not capture when the last stone lands in the sower's own pit", () => {
    // Pit 5 has 2 stones -> lands at 6, 7, both still player 0's row. Player
    // 1 keeps a stone elsewhere so this doesn't also trip no-legal-moves.
    const state = emptyBoardState({ pits: [0, 0, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0] });
    const { state: next, result } = applyMove(state, 5);
    expect(next.kazans).toEqual([0, 0]);
    expect(result).toEqual({ type: 'move-applied', sower: 0, captured: 0 });
  });

  it("does not capture when the opponent's pit ends on an odd count", () => {
    // Pit 8 has 1 stone -> lands at pit 9, which has 2 -> becomes 3 (odd).
    const state = emptyBoardState({ pits: [0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0] });
    const { state: next, result } = applyMove(state, 8);
    expect(next.pits[9]).toBe(3);
    expect(next.kazans).toEqual([0, 0]);
    expect(result).toEqual({ type: 'move-applied', sower: 0, captured: 0 });
  });
});

describe('Toguz Korgool — tuz', () => {
  it('cannot declare the ооз pit as tuz', () => {
    const state = startGame(createInitialState());
    expect(canDeclareTuz(state, 0, oozPit(0))).toBe(false);
  });

  it('cannot declare a second tuz once one is already set', () => {
    let state = startGame(createInitialState());
    state = declareTuz(state, 0, 3);
    expect(canDeclareTuz(state, 0, 4)).toBe(false);
    expect(() => declareTuz(state, 0, 4)).toThrow();
  });

  it("cannot declare a tuz at the same local position as the opponent's tuz", () => {
    let state = startGame(createInitialState());
    state = declareTuz(state, 1, 12); // player 1, local position 3 (12 - 9)
    expect(canDeclareTuz(state, 0, 3)).toBe(false); // player 0's local position 3
    expect(canDeclareTuz(state, 0, 4)).toBe(true);
  });

  it('sows normally into a legally declared tuz pit', () => {
    let state = startGame(createInitialState());
    state = declareTuz(state, 0, 3);
    expect(state.tuz[0]).toBe(3);
  });

  it('immediately redirects any stone landing in a tuz pit to the tuz owner\'s kazan, even mid-sow', () => {
    // Player 1's tuz is at pit 12. Player 0 sows 5 stones from their own pit
    // 8, landing at 9, 10, 11, 12 (tuz -> captured, not the last stone), 13.
    const state = emptyBoardState({
      pits: [0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 5, 0, 0, 0, 0, 0],
      tuz: [null, 12],
    });
    const { state: next, result } = applyMove(state, 8);
    expect(next.pits[12]).toBe(5); // untouched - the stone never landed in the pit
    expect(next.kazans[1]).toBe(1); // swept straight to the tuz owner
    expect(next.pits[13]).toBe(1); // the final stone sowed normally, past the tuz pit
    expect(result).toEqual({ type: 'move-applied', sower: 0, captured: 0 });
  });

  it('applies only the tuz capture (not also the even-count rule) when the last stone lands in a tuz pit', () => {
    // Pit 8 has 4 stones -> lands at 9, 10, 11, and finally 12 (the tuz pit,
    // pre-loaded with 4 stones so an even-count capture would otherwise fire).
    const state = emptyBoardState({
      pits: [0, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 4, 0, 0, 0, 0, 0],
      tuz: [null, 12],
    });
    const { state: next, result } = applyMove(state, 8);
    expect(next.pits[12]).toBe(4); // pit itself never accumulates the swept stone
    expect(next.kazans[1]).toBe(1);
    expect(result).toEqual({ type: 'move-applied', sower: 0, captured: 0 });
  });
});

describe('Toguz Korgool — win condition detection', () => {
  it('declares a win the moment a capture brings a kazan to 82 or more', () => {
    const state = emptyBoardState({ pits: [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0], kazans: [80, 0] });
    const { state: next, result } = applyMove(state, 8);
    expect(result).toEqual({ type: 'game-won', winner: 0, kazanCount: 82 });
    expect(next.status).toBe('won');
    expect(next.winner).toBe(0);
  });

  it('does not report a win below the 82-stone threshold', () => {
    const state = startGame(createInitialState());
    const { state: next, result } = applyMove(state, 0);
    expect(result.type).not.toBe('game-won');
    expect(next.status).toBe('in-progress');
  });
});

describe('Toguz Korgool — no-legal-moves detection', () => {
  it("reports no-legal-moves for the next player when their whole row is empty", () => {
    const state = emptyBoardState({ pits: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] });
    const { state: next, result } = applyMove(state, 0);
    expect(result).toEqual({ type: 'no-legal-moves', player: 1 });
    expect(next.status).toBe('no-legal-moves');
    expect(hasLegalMove(next, 1)).toBe(false);
  });
});

describe('Toguz Korgool — applyMove guards', () => {
  it('throws if called with an illegal move', () => {
    const state = startGame(createInitialState());
    expect(() => applyMove(state, 9)).toThrow(); // pit 9 belongs to the opponent
  });

  it('throws if called while the game is not in-progress', () => {
    const state = createInitialState();
    expect(() => applyMove(state, 0)).toThrow();
  });
});
