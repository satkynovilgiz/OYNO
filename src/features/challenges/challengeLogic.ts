import type { Collection } from '@/features/collections/collectionsData';
import { dayNumber } from '@/services/daily/dailyDiscovery';

import { QUESTION_BANK, type ChallengeQuestion } from './questionBank';

/**
 * Pure challenge assembly. Challenge progress is its own record (see
 * useChallengeStore) and never touches Culture/Explore discovery progress:
 * answering a question correctly does not mark anything discovered.
 */
export type ChallengeKind = 'daily' | 'collection' | 'journey';

export const DAILY_QUESTION_COUNT = 5;
export const CHILD_DAILY_QUESTION_COUNT = 3;
export const MIN_JOURNEY_QUESTIONS = 3;
export const MAX_CHALLENGE_QUESTIONS = 10;

function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Today's Daily Challenge: the same questions for everyone on the same
 * local date (the bank ordered by a date-seeded hash), different tomorrow.
 * Never re-randomised on reopen - and the chosen ids are also persisted for
 * the day by the store, so a content update mid-day can't swap them.
 */
export function pickDailyQuestionIds(dateKey: string, count: number, bank: ChallengeQuestion[] = QUESTION_BANK): string[] {
  const seed = String(dayNumber(dateKey));
  return [...bank]
    .sort((a, b) => hash(`${seed}:${a.id}`) - hash(`${seed}:${b.id}`) || a.id.localeCompare(b.id))
    .slice(0, count)
    .map((question) => question.id);
}

/** Culture Challenge: the questions whose source is part of a collection. */
export function collectionQuestionIds(collection: Collection, bank: ChallengeQuestion[] = QUESTION_BANK): string[] {
  const refs = new Set(collection.sections.map((ref) => `${ref.kind}:${ref.id}`));
  return bank.filter((question) => refs.has(`${question.sourceType}:${question.sourceId}`)).slice(0, MAX_CHALLENGE_QUESTIONS).map((question) => question.id);
}

/**
 * Journey Challenge: only questions about content the user has really been
 * to - destinations in `visitedRegionIds` and culture items completed as
 * Daily OYNO. Empty below MIN_JOURNEY_QUESTIONS (the screen says how to
 * unlock it instead of padding with unrelated questions).
 */
export function journeyQuestionIds(visitedRegionIds: string[], completedDailyItemIds: string[], bank: ChallengeQuestion[] = QUESTION_BANK): string[] {
  const explored = new Set([...visitedRegionIds.map((id) => `destination:${id}`), ...completedDailyItemIds.map((id) => `culture_item:${id}`)]);
  const ids = bank.filter((question) => explored.has(`${question.sourceType}:${question.sourceId}`)).map((question) => question.id);
  return ids.length >= MIN_JOURNEY_QUESTIONS ? ids.slice(0, MAX_CHALLENGE_QUESTIONS) : [];
}

export type AnswerRecord = { questionId: string; optionId: string };

export function scoreAnswers(answers: AnswerRecord[], bank: ChallengeQuestion[] = QUESTION_BANK): { correct: number; total: number } {
  const byId = new Map(bank.map((question) => [question.id, question]));
  const correct = answers.filter((answer) => byId.get(answer.questionId)?.correctOptionId === answer.optionId).length;
  return { correct, total: answers.length };
}

/** Structural checks used by the question-bank tests. */
export function validateQuestion(question: ChallengeQuestion): string[] {
  const errors: string[] = [];
  const optionIds = question.options.map((option) => option.id);
  if (new Set(optionIds).size !== optionIds.length) errors.push('duplicate option ids');
  if (optionIds.filter((id) => id === question.correctOptionId).length !== 1) errors.push('needs exactly one correct option');
  if (question.kind === 'trueFalse' && optionIds.join(',') !== 'true,false') errors.push('true/false options must be true,false');
  if (question.kind === 'image' && question.options.some((option) => !option.image)) errors.push('image options need images');
  if (question.kind === 'multiple' && question.options.length < 3) errors.push('multiple choice needs 3+ options');
  return errors;
}
