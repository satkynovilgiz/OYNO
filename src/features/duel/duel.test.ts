import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import { seededRng } from '@/features/detective/detectiveModel';

import { cleanName, duelReducer, firstPlayer, outcome, ranking, rematch, scores, startDuel, turnOrder, visible, type DuelState } from './duelModel';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));

const start = (rounds: 3 | 5 = 3, seed = 11) => startDuel({ names: ['  Aibek   K ', ''], rounds }, seededRng(seed));
const correctOf = (state: DuelState, round: number) => state.questions[round].sourceId;
const wrongOf = (state: DuelState, round: number) => state.questions[round].options.find((option) => option !== correctOf(state, round))!;
/** Plays one full round: the first player picks `a`, the second `b` ('right' / 'wrong'). */
function playRound(state: DuelState, a: 'right' | 'wrong', b: 'right' | 'wrong'): DuelState {
  const round = state.phase.kind === 'handoff' ? state.phase.round : -1;
  const pick = (kind: 'right' | 'wrong') => (kind === 'right' ? correctOf(state, round) : wrongOf(state, round));
  let next = duelReducer(state, { type: 'ready' });
  next = duelReducer(next, { type: 'answer', optionId: pick(a) });
  next = duelReducer(next, { type: 'ready' });
  next = duelReducer(next, { type: 'answer', optionId: pick(b) });
  return duelReducer(next, { type: 'next' });
}

describe('setup', () => {
  it('3 or 5 different rounds; both players get the SAME question with the SAME answer order', () => {
    for (const rounds of [3, 5] as const) {
      const state = start(rounds);
      expect(state.questions).toHaveLength(rounds);
      expect(new Set(state.questions.map((question) => question.questionId)).size).toBe(rounds);
    }
    // One question object per round = identical for both players by construction.
    expect(start().answers).toEqual([[null, null], [null, null], [null, null]]);
  });

  it('nicknames are tidied and optional', () => {
    expect(start().names).toEqual(['Aibek K', '']);
    expect(cleanName('x'.repeat(50))).toHaveLength(20);
  });
});

describe('turn transitions and answer concealment', () => {
  it('handoff -> turn -> handoff to the OTHER player -> turn -> reveal; first player alternates each round', () => {
    let state = start();
    expect(state.phase).toEqual({ kind: 'handoff', round: 0, player: 0 });
    state = duelReducer(state, { type: 'ready' });
    expect(state.phase).toEqual({ kind: 'answering', round: 0, player: 0 });
    state = duelReducer(state, { type: 'answer', optionId: correctOf(state, 0) });
    expect(state.phase).toEqual({ kind: 'handoff', round: 0, player: 1 });
    state = duelReducer(state, { type: 'ready' });
    state = duelReducer(state, { type: 'answer', optionId: wrongOf(state, 0) });
    expect(state.phase).toEqual({ kind: 'reveal', round: 0 });
    state = duelReducer(state, { type: 'next' });
    expect(state.phase).toEqual({ kind: 'handoff', round: 1, player: 1 });
    expect([0, 1, 2, 3].map((round) => firstPlayer(round))).toEqual([0, 1, 0, 1]);
  });

  it('the handoff and the second turn reveal NOTHING about the first answer or the correct one', () => {
    let state = duelReducer(start(), { type: 'ready' });
    const first = wrongOf(state, 0);
    // During the first turn the correct answer is not part of the view.
    const turn = visible(state);
    expect(turn.kind === 'answering' && turn.question.sourceId).toBe('');
    state = duelReducer(state, { type: 'answer', optionId: first });
    const handoff = visible(state);
    expect(handoff).toEqual({ kind: 'handoff', round: 0, player: 1 });
    expect(JSON.stringify(handoff)).not.toContain(first);
    state = duelReducer(state, { type: 'ready' });
    const second = visible(state);
    expect(JSON.stringify(second)).not.toContain('"chosen"');
    expect(second.kind === 'answering' && second.question.sourceId).toBe('');
    // Scores are not updated before the reveal either (they could hint at the answer).
    expect(scores(state)).toEqual([0, 0]);
    state = duelReducer(state, { type: 'answer', optionId: correctOf(state, 0) });
    const reveal = visible(state);
    expect(reveal).toMatchObject({ kind: 'reveal', chosen: [first, correctOf(state, 0)], correct: [false, true], scores: [0, 1] });
  });

  it('app backgrounded mid-turn: back to "pass the phone" for the same player, nothing recorded', () => {
    let state = duelReducer(start(), { type: 'ready' });
    state = duelReducer(state, { type: 'conceal' });
    expect(state.phase).toEqual({ kind: 'handoff', round: 0, player: 0 });
    expect(state.answers[0]).toEqual([null, null]);
    // Concealing outside a turn changes nothing.
    expect(duelReducer(state, { type: 'conceal' })).toBe(state);
  });

  it('a double tap, an answer out of turn or a bogus option never scores twice', () => {
    let state = duelReducer(start(), { type: 'ready' });
    const right = correctOf(state, 0);
    state = duelReducer(state, { type: 'answer', optionId: right });
    expect(duelReducer(state, { type: 'answer', optionId: right })).toBe(state); // handoff now
    state = duelReducer(state, { type: 'ready' });
    expect(duelReducer(state, { type: 'answer', optionId: 'not-an-option' })).toBe(state);
    state = duelReducer(state, { type: 'answer', optionId: right });
    expect(duelReducer(state, { type: 'answer', optionId: right })).toBe(state); // reveal now
    expect(duelReducer(state, { type: 'ready' })).toBe(state);
    expect(scores(state)).toEqual([1, 1]);
  });
});

describe('scoring, ties, rematch', () => {
  it('1 point per correct answer; a win', () => {
    let state = start(3);
    state = playRound(state, 'right', 'wrong'); // round 0: P1 first -> P1 +1
    state = playRound(state, 'right', 'right'); // round 1: P2 first -> both +1
    state = playRound(state, 'wrong', 'right'); // round 2: P1 first -> P2 +1
    expect(state.phase).toEqual({ kind: 'final' });
    expect(outcome(state)).toMatchObject({ kind: 'tie', leaders: [0, 1], scores: [2, 2] });
  });

  it('a clear winner, either way round', () => {
    let state = start(3);
    for (let round = 0; round < 3; round += 1) state = playRound(state, 'right', 'wrong');
    // P1 answers first in rounds 0 and 2, P2 first in round 1 -> the "first" answer was P1, P2, P1.
    expect(outcome(state)).toMatchObject({ kind: 'win', winner: 0, scores: [2, 1] });
  });

  it('rematch: same players and length, new match from zero', () => {
    let state = start(5, 3);
    for (let round = 0; round < 5; round += 1) state = playRound(state, 'right', 'right');
    const again = rematch(state, seededRng(99));
    expect(again).toMatchObject({ names: state.names, rounds: 5, phase: { kind: 'handoff', round: 0, player: 0 } });
    expect(scores(again)).toEqual([0, 0]);
    expect(outcome(again)).toBeNull();
  });
});

describe('separation, privacy, languages', () => {
  const screen = fs.readFileSync(path.join(__dirname, 'DuelScreen.tsx'), 'utf8');
  const model = fs.readFileSync(path.join(__dirname, 'duelModel.ts'), 'utf8');

  it('nothing is stored, tracked with names, or counted as progress / records', () => {
    for (const code of [screen, model]) {
      expect(code).not.toMatch(/AsyncStorage|useGameRecordsStore|useProgressStore|useChallengeStore|useDetectiveStore|useReadingStore|track\(/);
    }
    expect(screen).toContain("useTrackScreenView('culture_duel')");
  });

  it('KG / RU / EN', () => {
    const keys = Object.keys((en as unknown as { duel: Record<string, string> }).duel);
    for (const locale of [kg, ru]) for (const key of keys) expect([key, !!(locale as unknown as { duel: Record<string, string> }).duel[key]]).toEqual([key, true]);
  });
});

describe('Party Mode (3-4 players)', () => {
  const party = (players: number, rounds: 3 | 5 = 3) => startDuel({ names: ['A', 'B', 'C', 'D'].slice(0, players), rounds }, seededRng(5));
  /** Everyone answers round r; picks[player] = 'right' | 'wrong'. Returns the phases seen. */
  function playPartyRound(state: DuelState, picks: ('right' | 'wrong')[]) {
    const round = state.phase.kind === 'handoff' ? state.phase.round : -1;
    const seen: string[] = [];
    let next = state;
    while (next.phase.kind === 'handoff') {
      const player = next.phase.player;
      seen.push(`handoff:${player}`);
      // During every handoff nothing about earlier answers is visible.
      expect(JSON.stringify(visible(next))).not.toMatch(/chosen|correct|sourceId/);
      expect(scores(next)).toEqual(scores(state));
      next = duelReducer(next, { type: 'ready' });
      // A double tap on "ready" or on the answer never skips or double-scores.
      next = duelReducer(next, { type: 'ready' });
      const option = picks[player] === 'right' ? next.questions[round].sourceId : next.questions[round].options.find((value) => value !== next.questions[round].sourceId)!;
      next = duelReducer(next, { type: 'answer', optionId: option });
      next = duelReducer(next, { type: 'answer', optionId: option });
    }
    expect(next.phase).toEqual({ kind: 'reveal', round });
    return { state: duelReducer(next, { type: 'next' }), seen };
  }

  it('the starting player rotates through every seat; everyone answers once per round', () => {
    expect([0, 1, 2, 3, 4].map((round) => turnOrder(round, 4))).toEqual([[0, 1, 2, 3], [1, 2, 3, 0], [2, 3, 0, 1], [3, 0, 1, 2], [0, 1, 2, 3]]);
    expect([0, 1, 2].map((round) => turnOrder(round, 3)[0])).toEqual([0, 1, 2]);
    expect([0, 1, 2, 3].map((round) => firstPlayer(round, 2))).toEqual([0, 1, 0, 1]); // two-player duel unchanged
    let state = party(4, 5);
    for (let round = 0; round < 5; round += 1) {
      const result = playPartyRound(state, ['right', 'wrong', 'right', 'wrong']);
      expect(result.seen).toEqual(turnOrder(round, 4).map((player) => `handoff:${player}`));
      state = result.state;
    }
    expect(state.phase).toEqual({ kind: 'final' });
  });

  it('points are awarded only after everyone answered, from the answers', () => {
    let state = party(3);
    state = duelReducer(state, { type: 'ready' });
    state = duelReducer(state, { type: 'answer', optionId: state.questions[0].sourceId });
    state = duelReducer(state, { type: 'ready' });
    state = duelReducer(state, { type: 'answer', optionId: state.questions[0].sourceId });
    expect(scores(state)).toEqual([0, 0, 0]); // one player still to answer
    state = duelReducer(state, { type: 'ready' });
    state = duelReducer(state, { type: 'answer', optionId: state.questions[0].options.find((option) => option !== state.questions[0].sourceId)! });
    expect(visible(state)).toMatchObject({ kind: 'reveal', correct: [true, true, false], scores: [1, 1, 0] });
  });

  it('final ranking: equal scores share a position', () => {
    expect(ranking([3, 3, 1, 0]).map(({ player, position }) => [player, position])).toEqual([[0, 1], [1, 1], [2, 3], [3, 4]]);
    expect(ranking([2, 5, 2, 5]).map(({ player, position }) => [player, position])).toEqual([[1, 1], [3, 1], [0, 3], [2, 3]]);
    let state = party(4);
    for (let round = 0; round < 3; round += 1) state = playPartyRound(state, ['right', 'right', 'wrong', 'wrong']).state;
    expect(outcome(state)).toMatchObject({ kind: 'tie', leaders: [0, 1], scores: [3, 3, 0, 0] });
    expect(outcome(state)!.ranking.map((entry) => entry.position)).toEqual([1, 1, 3, 3]);
  });

  it('backgrounding mid-turn returns to that player\'s handoff; rematch keeps all players', () => {
    let state = duelReducer(party(4), { type: 'ready' });
    state = duelReducer(state, { type: 'conceal' });
    expect(state.phase).toEqual({ kind: 'handoff', round: 0, player: 0 });
    expect(rematch(state, seededRng(1)).names).toEqual(['A', 'B', 'C', 'D']);
  });
});
