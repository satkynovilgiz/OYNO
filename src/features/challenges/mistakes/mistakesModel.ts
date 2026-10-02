/**
 * Challenge Mistake Review - pure rules. Only references are kept
 * ({ questionId, dates, count }); QUESTION_BANK stays the one source of
 * every question, option, explanation and source.
 */

export type MistakeRecord = {
  questionId: string;
  firstWrongAt: string;
  lastWrongAt: string;
  wrongCount: number;
};

export type MistakesData = {
  /** Questions still to revisit. */
  active: Record<string, MistakeRecord>;
  /** When a question was last answered correctly in Review ("Reviewed"). */
  reviewedAt: Record<string, string>;
};

export const EMPTY_MISTAKES: MistakesData = { active: {}, reviewedAt: {} };

function bump(previous: MistakeRecord | undefined, questionId: string, at: string): MistakeRecord {
  return previous
    ? { ...previous, lastWrongAt: at, wrongCount: previous.wrongCount + 1 }
    : { questionId, firstWrongAt: at, lastWrongAt: at, wrongCount: 1 };
}

/** A FINISHED normal challenge: every wrongly answered question is added
 * (or its count goes up). Correct answers change nothing. */
export function recordFinishedAttempt(data: MistakesData, wrongQuestionIds: readonly string[], now = new Date()): MistakesData {
  if (wrongQuestionIds.length === 0) return data;
  const at = now.toISOString();
  const active = { ...data.active };
  for (const id of new Set(wrongQuestionIds)) active[id] = bump(active[id], id, at);
  return { ...data, active };
}

/** One answer in Review: right -> leaves the queue ("Reviewed"); wrong ->
 * stays, with its count and date bumped. */
export function recordReviewAnswer(data: MistakesData, questionId: string, correct: boolean, now = new Date()): MistakesData {
  const at = now.toISOString();
  if (correct) {
    if (!data.active[questionId]) return data;
    const active = { ...data.active };
    delete active[questionId];
    return { active, reviewedAt: { ...data.reviewedAt, [questionId]: at } };
  }
  return { ...data, active: { ...data.active, [questionId]: bump(data.active[questionId], questionId, at) } };
}

/** Drops references to questions that no longer exist in QUESTION_BANK. */
export function pruneStale(data: MistakesData, exists: (questionId: string) => boolean): MistakesData {
  const staleActive = Object.keys(data.active).filter((id) => !exists(id));
  const staleReviewed = Object.keys(data.reviewedAt).filter((id) => !exists(id));
  if (staleActive.length === 0 && staleReviewed.length === 0) return data;
  const active = { ...data.active };
  const reviewedAt = { ...data.reviewedAt };
  for (const id of staleActive) delete active[id];
  for (const id of staleReviewed) delete reviewedAt[id];
  return { active, reviewedAt };
}

/** Deterministic review order: most often wrong, then most recently
 * wrong, then question id. Never random. Stale ids are skipped. */
export function reviewQueue(data: MistakesData, exists: (questionId: string) => boolean): MistakeRecord[] {
  return Object.values(data.active)
    .filter((record) => exists(record.questionId))
    .sort((a, b) => b.wrongCount - a.wrongCount || b.lastWrongAt.localeCompare(a.lastWrongAt) || a.questionId.localeCompare(b.questionId));
}

/** Guest -> account: one record per question; earliest first date, latest
 * last date, counts added. */
export function mergeMistakes(into: MistakesData, from: MistakesData): MistakesData {
  const active = { ...into.active };
  for (const [id, record] of Object.entries(from.active)) {
    const existing = active[id];
    active[id] = existing
      ? {
          questionId: id,
          firstWrongAt: existing.firstWrongAt < record.firstWrongAt ? existing.firstWrongAt : record.firstWrongAt,
          lastWrongAt: existing.lastWrongAt > record.lastWrongAt ? existing.lastWrongAt : record.lastWrongAt,
          wrongCount: existing.wrongCount + record.wrongCount,
        }
      : record;
  }
  const reviewedAt = { ...into.reviewedAt };
  for (const [id, at] of Object.entries(from.reviewedAt)) if (!reviewedAt[id] || at > reviewedAt[id]) reviewedAt[id] = at;
  return { active, reviewedAt };
}

/** The questions answered wrongly in a finished run. */
export function wrongIdsOf(questions: readonly { id: string; correctOptionId: string }[], answers: readonly { questionId: string; optionId: string }[]): string[] {
  return questions.filter((question) => answers.some((answer) => answer.questionId === question.id && answer.optionId !== question.correctOptionId)).map((question) => question.id);
}
