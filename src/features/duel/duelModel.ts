import { buildSession, seededRng, type Rng, type SessionQuestion } from '@/features/detective/detectiveModel';

/**
 * Culture Duel - two people, one phone, no accounts or network.
 *
 * Fairness: each round BOTH players get the SAME question (same picture,
 * same clue, same four answers in the same order); 1 point per correct
 * answer; who answers first alternates every round. Nothing about the
 * other player's choice - or the correct answer - is visible until both
 * have answered (`visible`). Scores are DERIVED from the recorded answers,
 * so nothing can be counted twice. Nothing here is stored or sent: names
 * and results live only in this match.
 */
export type MatchLength = 3 | 5;
export type PlayerIndex = 0 | 1;
export const MAX_NAME_LENGTH = 20;

export type DuelPhase =
  /** "Pass the phone to <player>" - shows nothing about the round's answers. */
  | { kind: 'handoff'; round: number; player: PlayerIndex }
  | { kind: 'answering'; round: number; player: PlayerIndex }
  /** Both answered: both answers + the correct one + the explanation. */
  | { kind: 'reveal'; round: number }
  | { kind: 'final' };

export type DuelState = {
  names: [string, string];
  rounds: MatchLength;
  questions: SessionQuestion[];
  /** answers[round][player] - the option chosen, or null. */
  answers: [string | null, string | null][];
  phase: DuelPhase;
};

/** Trimmed, length-limited; empty = the default label is shown instead. */
export function cleanName(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
}

/** Round r starts with player 0 on even rounds, player 1 on odd ones. */
export const firstPlayer = (round: number): PlayerIndex => (round % 2 === 0 ? 0 : 1);
const other = (player: PlayerIndex): PlayerIndex => (player === 0 ? 1 : 0);

export function startDuel(input: { names: [string, string]; rounds: MatchLength }, rng: Rng = seededRng(Date.now())): DuelState {
  const questions = buildSession(rng, { length: input.rounds });
  return {
    names: [cleanName(input.names[0]), cleanName(input.names[1])],
    rounds: questions.length as MatchLength,
    questions,
    answers: questions.map(() => [null, null]),
    phase: { kind: 'handoff', round: 0, player: firstPlayer(0) },
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
  switch (action.type) {
    case 'ready':
      return phase.kind === 'handoff' ? { ...state, phase: { kind: 'answering', round: phase.round, player: phase.player } } : state;
    case 'conceal':
      return phase.kind === 'answering' ? { ...state, phase: { kind: 'handoff', round: phase.round, player: phase.player } } : state;
    case 'answer': {
      if (phase.kind !== 'answering') return state;
      const question = state.questions[phase.round];
      if (!question.options.includes(action.optionId) || state.answers[phase.round][phase.player] !== null) return state;
      const answers = state.answers.map((pair, index) => (index === phase.round ? (phase.player === 0 ? [action.optionId, pair[1]] : [pair[0], action.optionId]) : pair)) as DuelState['answers'];
      const next = answers[phase.round][other(phase.player)] === null ? ({ kind: 'handoff', round: phase.round, player: other(phase.player) } as const) : ({ kind: 'reveal', round: phase.round } as const);
      return { ...state, answers, phase: next };
    }
    case 'next':
      if (phase.kind !== 'reveal') return state;
      return phase.round + 1 >= state.questions.length ? { ...state, phase: { kind: 'final' } } : { ...state, phase: { kind: 'handoff', round: phase.round + 1, player: firstPlayer(phase.round + 1) } };
  }
}

/** Same players and length, new questions, scores from zero. */
export function rematch(state: DuelState, rng: Rng = seededRng(Date.now())): DuelState {
  return startDuel({ names: state.names, rounds: state.rounds }, rng);
}

const isCorrect = (state: DuelState, round: number, player: PlayerIndex) => state.answers[round][player] === state.questions[round].sourceId;

/** Points so far - counted only for REVEALED rounds (so a score never hints at an answer). */
export function scores(state: DuelState): [number, number] {
  const revealedRounds = state.phase.kind === 'final' ? state.questions.length : state.phase.kind === 'reveal' ? state.phase.round + 1 : state.phase.round;
  const totals: [number, number] = [0, 0];
  for (let round = 0; round < revealedRounds; round += 1) for (const player of [0, 1] as const) if (isCorrect(state, round, player)) totals[player] += 1;
  return totals;
}

export type DuelOutcome = { kind: 'win'; winner: PlayerIndex; scores: [number, number] } | { kind: 'tie'; scores: [number, number] };

export function outcome(state: DuelState): DuelOutcome | null {
  if (state.phase.kind !== 'final') return null;
  const totals = scores(state);
  return totals[0] === totals[1] ? { kind: 'tie', scores: totals } : { kind: 'win', winner: totals[0] > totals[1] ? 0 : 1, scores: totals };
}

/**
 * Exactly what the screen may show now. During a handoff or a turn,
 * neither player's choice nor the correct answer is available - only
 * the question itself (and only to the player whose turn it is).
 */
export type DuelView =
  | { kind: 'handoff'; round: number; player: PlayerIndex }
  | { kind: 'answering'; round: number; player: PlayerIndex; question: SessionQuestion }
  | { kind: 'reveal'; round: number; question: SessionQuestion; chosen: [string, string]; correct: [boolean, boolean]; scores: [number, number] }
  | { kind: 'final'; outcome: DuelOutcome };

export function visible(state: DuelState): DuelView {
  const { phase } = state;
  switch (phase.kind) {
    case 'handoff':
      return { kind: 'handoff', round: phase.round, player: phase.player };
    case 'answering': {
      const { sourceId: _hidden, ...rest } = state.questions[phase.round];
      void _hidden;
      // The correct answer is NOT part of what a turn may show.
      return { kind: 'answering', round: phase.round, player: phase.player, question: { ...rest, sourceId: '' } };
    }
    case 'reveal': {
      const [first, second] = state.answers[phase.round];
      return { kind: 'reveal', round: phase.round, question: state.questions[phase.round], chosen: [first!, second!], correct: [isCorrect(state, phase.round, 0), isCorrect(state, phase.round, 1)], scores: scores(state) };
    }
    case 'final':
      return { kind: 'final', outcome: outcome(state)! };
  }
}
