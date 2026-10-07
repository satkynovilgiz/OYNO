import type { Answer } from './detectiveModel';
import type { Expedition, ExpeditionId } from './expeditions';

/**
 * What was answered during ONE visit to ONE expedition by ONE owner - the
 * data behind "What you discovered". A round for a different owner or
 * expedition starts a new visit, so nothing from another expedition (or
 * account) can ever show in a summary. Learning and challenge stay as they
 * were answered; practice answers are merged by question (latest wins) and
 * kept apart from them.
 */
export type ExpeditionVisit = {
  owner: string;
  id: ExpeditionId;
  learning: Answer[] | null;
  challenge: Answer[] | null;
  practice: Record<string, Answer>;
};

export type VisitRound = 'learning' | 'challenge' | 'practice';

export const newVisit = (owner: string, id: ExpeditionId): ExpeditionVisit => ({ owner, id, learning: null, challenge: null, practice: {} });

/** The visit, only when it belongs to this owner and expedition. */
export function visitFor(visit: ExpeditionVisit | null, owner: string, id: ExpeditionId): ExpeditionVisit | null {
  return visit && visit.owner === owner && visit.id === id ? visit : null;
}

/** Folds a finished round into the visit. A new learning round starts a new visit. */
export function recordRound(visit: ExpeditionVisit | null, owner: string, id: ExpeditionId, round: VisitRound, answers: readonly Answer[]): ExpeditionVisit {
  const base = visitFor(visit, owner, id) ?? newVisit(owner, id);
  switch (round) {
    case 'learning':
      return { ...newVisit(owner, id), learning: [...answers] };
    case 'challenge':
      return { ...base, challenge: [...answers] };
    case 'practice':
      return { ...base, practice: { ...base.practice, ...Object.fromEntries(answers.map((answer) => [answer.questionId, answer])) } };
  }
}

export type SummaryRow = { questionId: string; learning: Answer | null; challenge: Answer | null; practice: Answer | null };

export function summaryRows(visit: ExpeditionVisit | null, item: Expedition): SummaryRow[] {
  const find = (answers: Answer[] | null | undefined, questionId: string) => answers?.find((answer) => answer.questionId === questionId) ?? null;
  return item.questionIds.map((questionId) => ({
    questionId,
    learning: find(visit?.learning, questionId),
    challenge: find(visit?.challenge, questionId),
    practice: visit?.practice[questionId] ?? null,
  }));
}

/** The challenge score of this visit, or null when no challenge was taken in it. */
export function challengeTotal(visit: ExpeditionVisit | null, maxPerQuestion: number): { score: number; max: number } | null {
  if (!visit?.challenge) return null;
  return { score: visit.challenge.reduce((sum, answer) => sum + answer.points, 0), max: visit.challenge.length * maxPerQuestion };
}
