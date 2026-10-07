import { DETECTIVE_QUESTIONS, type DetectiveQuestion } from './detectiveQuestions';

/**
 * Culture Detective rules (pure, no timers - nothing here can pressure):
 *  - a session is SESSION_LENGTH different questions (never a repeat);
 *  - up to three clues can be revealed before answering;
 *  - a correct answer scores more the fewer clues were needed
 *    (CLUE_POINTS[revealed]); a wrong answer scores 0 and the explanation
 *    shows - it is a learning step, not a penalty;
 *  - "Focus on missed" builds a round from the questions missed last time.
 */
export const SESSION_LENGTH = 5;
export const MAX_CLUES = 3;
/** Points for a correct answer after revealing 0, 1, 2 or 3 clues. */
export const CLUE_POINTS = [4, 3, 2, 1] as const;
export const MAX_SESSION_SCORE = SESSION_LENGTH * CLUE_POINTS[0];

export type Rng = () => number;

/** Deterministic PRNG (mulberry32) - tests and replays use a seed. */
export function seededRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let index = out.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    [out[index], out[swap]] = [out[swap], out[index]];
  }
  return out;
}

export type SessionQuestion = { questionId: string; sourceId: string; options: string[] };

/**
 * Picks the questions for one session: distinct, in random order, each with
 * its four answers shuffled. `onlyIds` = a focus round (those questions only,
 * up to SESSION_LENGTH); unknown ids are ignored.
 */
export function buildSession(rng: Rng, options: { onlyIds?: readonly string[]; length?: number; pool?: readonly DetectiveQuestion[] } = {}): SessionQuestion[] {
  const pool = options.pool ?? DETECTIVE_QUESTIONS;
  const wanted = options.onlyIds ? new Set(options.onlyIds) : null;
  const candidates = wanted ? pool.filter((question) => wanted.has(question.id)) : pool;
  const length = Math.min(options.length ?? SESSION_LENGTH, candidates.length);
  return shuffle(candidates, rng)
    .slice(0, length)
    .map((question) => ({ questionId: question.id, sourceId: question.sourceId, options: shuffle(question.optionIds, rng) }));
}

export type Answer = { questionId: string; chosen: string; correct: boolean; cluesRevealed: number; points: number };

export function scoreAnswer(question: SessionQuestion, chosen: string, cluesRevealed: number): Answer {
  const revealed = Math.max(0, Math.min(MAX_CLUES, Math.floor(cluesRevealed)));
  const correct = chosen === question.sourceId;
  return { questionId: question.questionId, chosen, correct, cluesRevealed: revealed, points: correct ? CLUE_POINTS[revealed] : 0 };
}

export type SessionState = {
  questions: SessionQuestion[];
  index: number;
  /** Clues revealed on the CURRENT question. */
  revealed: number;
  answers: Answer[];
  /** The current question is answered and its explanation is showing. */
  showingAnswer: boolean;
};

export function startSession(questions: SessionQuestion[]): SessionState {
  return { questions, index: 0, revealed: 0, answers: [], showingAnswer: false };
}

export type SessionAction = { type: 'reveal' } | { type: 'answer'; optionId: string } | { type: 'next' };

/** Every transition; invalid ones (double answer, reveal after answering, ...) change nothing. */
export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  const question = state.questions[state.index];
  if (!question) return state;
  switch (action.type) {
    case 'reveal':
      if (state.showingAnswer || state.revealed >= MAX_CLUES) return state;
      return { ...state, revealed: state.revealed + 1 };
    case 'answer':
      if (state.showingAnswer || !question.options.includes(action.optionId)) return state;
      return { ...state, answers: [...state.answers, scoreAnswer(question, action.optionId, state.revealed)], showingAnswer: true };
    case 'next':
      if (!state.showingAnswer) return state;
      return { ...state, index: state.index + 1, revealed: 0, showingAnswer: false };
  }
}

export const isFinished = (state: SessionState) => state.index >= state.questions.length;

export type SessionSummary = { score: number; maxScore: number; correct: number; total: number; missedIds: string[]; cluesUsed: number };

export function summarize(state: SessionState): SessionSummary {
  return {
    score: state.answers.reduce((sum, answer) => sum + answer.points, 0),
    maxScore: state.questions.length * CLUE_POINTS[0],
    correct: state.answers.filter((answer) => answer.correct).length,
    total: state.questions.length,
    missedIds: state.answers.filter((answer) => !answer.correct).map((answer) => answer.questionId),
    cluesUsed: state.answers.reduce((sum, answer) => sum + answer.cluesRevealed, 0),
  };
}
