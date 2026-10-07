import { buildSession, seededRng, type Rng, type SessionQuestion } from '@/features/detective/detectiveModel';

/**
 * Culture Duel - 2 players (the duel) or 3-4 (Party Mode), one phone, no
 * accounts or network.
 *
 * Fairness: each round EVERYONE gets the SAME question (same picture, same
 * clue, same four answers in the same order); 1 point per correct answer;
 * the starting player rotates every round (round r starts with player
 * r mod n, then the others in seat order). Nothing about anyone's choice -
 * or the correct answer - is visible until everyone has answered
 * (`visible`). Scores are DERIVED from the recorded answers and count only
 * revealed rounds, so nothing is counted twice or hinted early. Nothing
 * here is stored or sent: names and results live only in this match.
 */
export type MatchLength = 3 | 5;
export type PlayerCount = 2 | 3 | 4;
export const PLAYER_COUNTS: PlayerCount[] = [2, 3, 4];
export type PlayerIndex = number;
export const MAX_NAME_LENGTH = 20;

export type DuelPhase =
  /** "Pass the phone to <player>" - shows nothing about the round's answers. */
  | { kind: 'handoff'; round: number; player: PlayerIndex }
  | { kind: 'answering'; round: number; player: PlayerIndex }
  /** Everyone answered: all answers + the correct one + the explanation. */
  | { kind: 'reveal'; round: number }
  | { kind: 'final' };

export type DuelState = {
  names: string[];
  rounds: MatchLength;
  questions: SessionQuestion[];
  /** answers[round][player] - the option chosen, or null. */
  answers: (string | null)[][];
  phase: DuelPhase;
};

/** Trimmed, length-limited; empty = the default label is shown instead. */
export function cleanName(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
}

/** Who answers in round r, in order: starting with player r mod n, then seat order. */
export function turnOrder(round: number, players: number): PlayerIndex[] {
  const start = round % players;
  return Array.from({ length: players }, (_, offset) => (start + offset) % players);
}

/** Round r's starting player. */
export const firstPlayer = (round: number, players = 2): PlayerIndex => turnOrder(round, players)[0];

export function startDuel(input: { names: string[]; rounds: MatchLength }, rng: Rng = seededRng(Date.now())): DuelState {
  const players = Math.min(4, Math.max(2, input.names.length));
  const questions = buildSession(rng, { length: input.rounds });
  return {
    names: input.names.slice(0, players).map(cleanName),
    rounds: questions.length as MatchLength,
    questions,
    answers: questions.map(() => Array.from({ length: players }, () => null)),
    phase: { kind: 'handoff', round: 0, player: firstPlayer(0, players) },
  };
}

export type DuelAction =
  | { type: 'ready' }
  | { type: 'answer'; optionId: string }
  /** App backgrounded / screen hidden mid-turn: back to the handoff screen (nothing is recorded or shown). */
  | { type: 'conceal' }
  | { type: 'next' };

/** Every transition; anything out of turn (a double tap, the wrong phase) changes nothing. */
export function duelReducer(state: DuelState, action: DuelAction): DuelState {
  const { phase } = state;
  const players = state.names.length;
  switch (action.type) {
    case 'ready':
      return phase.kind === 'handoff' ? { ...state, phase: { kind: 'answering', round: phase.round, player: phase.player } } : state;
    case 'conceal':
      return phase.kind === 'answering' ? { ...state, phase: { kind: 'handoff', round: phase.round, player: phase.player } } : state;
    case 'answer': {
      if (phase.kind !== 'answering') return state;
      const question = state.questions[phase.round];
      if (!question.options.includes(action.optionId) || state.answers[phase.round][phase.player] !== null) return state;
      const answers = state.answers.map((row, index) => (index === phase.round ? row.map((value, player) => (player === phase.player ? action.optionId : value)) : row));
      // The next player in this round's order who hasn't answered; nobody left = reveal.
      const waiting = turnOrder(phase.round, players).find((player) => answers[phase.round][player] === null);
      return { ...state, answers, phase: waiting === undefined ? { kind: 'reveal', round: phase.round } : { kind: 'handoff', round: phase.round, player: waiting } };
    }
    case 'next':
      if (phase.kind !== 'reveal') return state;
      return phase.round + 1 >= state.questions.length ? { ...state, phase: { kind: 'final' } } : { ...state, phase: { kind: 'handoff', round: phase.round + 1, player: firstPlayer(phase.round + 1, players) } };
  }
}

/** Same players and length, new questions, scores from zero. */
export function rematch(state: DuelState, rng: Rng = seededRng(Date.now())): DuelState {
  return startDuel({ names: state.names, rounds: state.rounds }, rng);
}

const isCorrect = (state: DuelState, round: number, player: PlayerIndex) => state.answers[round][player] === state.questions[round].sourceId;

/** Points so far - counted only for REVEALED rounds (so a score never hints at an answer). */
export function scores(state: DuelState): number[] {
  const revealedRounds = state.phase.kind === 'final' ? state.questions.length : state.phase.kind === 'reveal' ? state.phase.round + 1 : state.phase.round;
  const totals = state.names.map(() => 0);
  for (let round = 0; round < revealedRounds; round += 1) state.names.forEach((_, player) => (totals[player] += isCorrect(state, round, player) ? 1 : 0));
  return totals;
}

/** Final ranking, best first; equal scores SHARE a position (1, 1, 3, ...); ties keep seat order. */
export type RankedPlayer = { player: PlayerIndex; score: number; position: number };
export function ranking(totals: readonly number[]): RankedPlayer[] {
  const sorted = totals.map((score, player) => ({ player, score })).sort((a, b) => b.score - a.score || a.player - b.player);
  return sorted.map((entry) => ({ ...entry, position: 1 + sorted.filter((other) => other.score > entry.score).length }));
}

export type DuelOutcome = { kind: 'win'; winner: PlayerIndex; scores: number[]; ranking: RankedPlayer[] } | { kind: 'tie'; leaders: PlayerIndex[]; scores: number[]; ranking: RankedPlayer[] };

export function outcome(state: DuelState): DuelOutcome | null {
  if (state.phase.kind !== 'final') return null;
  const totals = scores(state);
  const ranked = ranking(totals);
  const leaders = ranked.filter((entry) => entry.position === 1).map((entry) => entry.player);
  return leaders.length === 1 ? { kind: 'win', winner: leaders[0], scores: totals, ranking: ranked } : { kind: 'tie', leaders, scores: totals, ranking: ranked };
}

/**
 * Exactly what the screen may show now. During a handoff or a turn,
 * nobody's choice nor the correct answer is available - only the question
 * itself (and only to the player whose turn it is).
 */
export type DuelView =
  | { kind: 'handoff'; round: number; player: PlayerIndex }
  | { kind: 'answering'; round: number; player: PlayerIndex; question: SessionQuestion }
  | { kind: 'reveal'; round: number; question: SessionQuestion; chosen: string[]; correct: boolean[]; scores: number[] }
  | { kind: 'final'; outcome: DuelOutcome };

export function visible(state: DuelState): DuelView {
  const { phase } = state;
  switch (phase.kind) {
    case 'handoff':
      return { kind: 'handoff', round: phase.round, player: phase.player };
    case 'answering':
      // The correct answer is NOT part of what a turn may show.
      return { kind: 'answering', round: phase.round, player: phase.player, question: { ...state.questions[phase.round], sourceId: '' } };
    case 'reveal':
      return {
        kind: 'reveal',
        round: phase.round,
        question: state.questions[phase.round],
        chosen: state.answers[phase.round].map((value) => value!),
        correct: state.names.map((_, player) => isCorrect(state, phase.round, player)),
        scores: scores(state),
      };
    case 'final':
      return { kind: 'final', outcome: outcome(state)! };
  }
}
