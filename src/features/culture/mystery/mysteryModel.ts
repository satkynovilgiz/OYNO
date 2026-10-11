import { DETECTIVE_QUESTIONS, type DetectiveQuestion, type SourceField } from '@/features/detective/detectiveQuestions';

/**
 * Mystery Object - an untimed guessing round over existing culture
 * articles. The content is NOT new: each mystery is one of the reviewed
 * Culture Detective definitions, whose clues and explanation restate named
 * fields of an existing article (clue i <- `clueFields[i]` of `sourceId`;
 * texts: detective.questions.<id>.*, KG from the article, RU/EN from its
 * reviewed translation). Answer options are the reviewed NAMES of four real
 * articles (detective.names.<id>), exactly one of which is the source.
 *
 * Only definitions whose clues don't name their own answer are used
 * (checked in mystery.test.ts for every language).
 */
export const MYSTERY_IDS = ['tunduk', 'karkas', 'kiyiz-jabuu', 'eer', 'kok-boru', 'kyz-kuumai', 'shyrdak', 'umai-ene', 'shyrdak-colors'] as const;
export const MAX_CLUES = 3;

export type Mystery = { id: string; sourceId: string; clueFields: readonly SourceField[]; explanationField: SourceField; optionIds: readonly string[] };
export type ClueSource = { articleId: string; field: SourceField; textKey: string };

export const MYSTERIES: Mystery[] = MYSTERY_IDS.flatMap((id) => {
  const question: DetectiveQuestion | undefined = DETECTIVE_QUESTIONS.find((entry) => entry.id === id);
  return question ? [{ id, sourceId: question.sourceId, clueFields: question.clueFields, explanationField: question.explanationField, optionIds: question.optionIds }] : [];
});

/** Where each clue comes from - inspectable: the article id, its field, and the text key. */
export const clueSources = (mystery: Mystery): ClueSource[] => mystery.clueFields.map((field, index) => ({ articleId: mystery.sourceId, field, textKey: `detective.questions.${mystery.id}.clue${index + 1}` }));
export const explanationSource = (mystery: Mystery) => ({ articleId: mystery.sourceId, field: mystery.explanationField, textKey: `detective.questions.${mystery.id}.explanation` });

/** Offered only when the answer AND all three other options can be shown now (never an impossible round). */
export const availableMysteries = (exists: (articleId: string) => boolean): Mystery[] => MYSTERIES.filter((mystery) => mystery.optionIds.length === 4 && new Set(mystery.optionIds).size === 4 && mystery.optionIds.includes(mystery.sourceId) && mystery.optionIds.every(exists));

export type Rng = () => number;
const shuffle = <T,>(items: readonly T[], random: Rng): T[] => {
  const out = [...items];
  for (let index = out.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [out[index], out[swap]] = [out[swap], out[index]];
  }
  return out;
};

export type Attempt = {
  mysteryId: string;
  /** The four options in this round's (random) order. */
  options: string[];
  revealed: number;
  /** Wrong guesses so far (they stay disabled); the round continues. */
  wrong: string[];
  outcome: 'playing' | 'found' | 'shown';
};

export function startAttempt(mystery: Mystery, random: Rng = Math.random): Attempt {
  return { mysteryId: mystery.id, options: shuffle(mystery.optionIds, random), revealed: 1, wrong: [], outcome: 'playing' };
}

/** Picks a mystery that can be played now, preferring one not just played. */
export function pickMystery(pool: readonly Mystery[], previous: string | null, random: Rng = Math.random): Mystery | null {
  if (pool.length === 0) return null;
  const fresh = pool.filter((mystery) => mystery.id !== previous);
  const from = fresh.length ? fresh : pool;
  return from[Math.floor(random() * from.length)];
}

export type AttemptAction = { type: 'reveal' } | { type: 'guess'; optionId: string } | { type: 'showAnswer' };

export function attemptReducer(attempt: Attempt, action: AttemptAction, mystery: Mystery): Attempt {
  if (attempt.outcome !== 'playing') return attempt;
  switch (action.type) {
    case 'reveal':
      return attempt.revealed < MAX_CLUES ? { ...attempt, revealed: attempt.revealed + 1 } : attempt;
    case 'guess':
      if (!attempt.options.includes(action.optionId) || attempt.wrong.includes(action.optionId)) return attempt;
      if (action.optionId === mystery.sourceId) return { ...attempt, outcome: 'found' };
      return { ...attempt, wrong: [...attempt.wrong, action.optionId] };
    case 'showAnswer':
      return { ...attempt, outcome: 'shown' };
  }
}

/* ---------- the attempt in progress (memory, owner-bound) - survives opening a source ---------- */

let kept: { owner: string; attempt: Attempt } | null = null;
export const keepAttempt = (owner: string, attempt: Attempt | null) => {
  kept = attempt ? { owner, attempt: { ...attempt, options: [...attempt.options], wrong: [...attempt.wrong] } } : null;
};
export const resumeAttempt = (owner: string): Attempt | null => (kept && kept.owner === owner ? kept.attempt : null);
