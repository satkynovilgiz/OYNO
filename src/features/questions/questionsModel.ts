import { draftMap, ownerKey } from '@/services/drafts/draftRegistry';

/**
 * My Questions - the reader's own questions, saved from an article section.
 * Pure rules; storage is useQuestionsStore (on this device, per owner).
 *
 * - The origin is a stable reference: article id + SECTION KEY, with the
 *   article title and section label kept as a snapshot. If the section
 *   disappears, the question keeps its snapshot and says so - it is never
 *   attached to another section.
 * - Supporting references are existing OYNO articles (by id, snapshot title).
 *   The personal answer is the reader's own words and is always labelled so.
 *   Nothing is generated, suggested or certified.
 * - "Answered for now" only changes the status: the question, its sources
 *   and the answer all stay; it can be reopened.
 */
export const QUESTION_MAX = 300;
export const ANSWER_MAX = 1500;
export const MAX_SUPPORTS = 6;
export const MAX_QUESTIONS = 200;

export type QuestionOrigin = { articleId: string; sectionKey: string; articleTitle: string; sectionLabel: string };
export type SupportRef = { articleId: string; title: string };
export type QuestionStatus = 'exploring' | 'answered';
export type Question = {
  id: string;
  text: string;
  origin: QuestionOrigin | null;
  supports: SupportRef[];
  answer: string;
  status: QuestionStatus;
  createdAt: string;
  updatedAt: string;
  answeredAt: string | null;
};
export type Questions = Record<string, Question>;

export const cleanText = (text: string, max: number) => text.replace(/\s+$/g, '').slice(0, max);
export const isValidQuestion = (text: string) => text.trim().length > 0 && text.length <= QUESTION_MAX;

export function newQuestion(id: string, text: string, origin: QuestionOrigin | null, now: string): Question {
  return { id, text: cleanText(text.trim(), QUESTION_MAX), origin, supports: [], answer: '', status: 'exploring', createdAt: now, updatedAt: now, answeredAt: null };
}

export type QuestionChange =
  | { type: 'text'; text: string }
  | { type: 'answer'; answer: string }
  | { type: 'addSupport'; support: SupportRef }
  | { type: 'removeSupport'; articleId: string }
  | { type: 'markAnswered' }
  | { type: 'reopen' };

/** One change; returns the SAME object when nothing changes (or the change isn't allowed). */
export function applyChange(question: Question, change: QuestionChange, now: string): Question {
  const touch = (next: Partial<Question>): Question => ({ ...question, ...next, updatedAt: now });
  switch (change.type) {
    case 'text': {
      if (!isValidQuestion(change.text)) return question;
      const text = cleanText(change.text.trim(), QUESTION_MAX);
      return text === question.text ? question : touch({ text });
    }
    case 'answer': {
      const answer = cleanText(change.answer, ANSWER_MAX);
      return answer === question.answer ? question : touch({ answer });
    }
    case 'addSupport':
      if (question.supports.length >= MAX_SUPPORTS || question.supports.some((s) => s.articleId === change.support.articleId)) return question;
      return touch({ supports: [...question.supports, { articleId: change.support.articleId, title: change.support.title }] });
    case 'removeSupport':
      return question.supports.some((s) => s.articleId === change.articleId) ? touch({ supports: question.supports.filter((s) => s.articleId !== change.articleId) }) : question;
    case 'markAnswered':
      return question.status === 'answered' ? question : touch({ status: 'answered', answeredAt: now });
    case 'reopen':
      return question.status === 'exploring' ? question : touch({ status: 'exploring', answeredAt: null });
  }
}

/** Sorted lists for "Still exploring" and "Answered for now" (newest change first). */
export function byStatus(questions: Questions, status: QuestionStatus): Question[] {
  return Object.values(questions)
    .filter((question) => question.status === status)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** What the origin is NOW: live section, article without that section, or gone. Never another section. */
export type OriginView = { state: 'live'; route: string; title: string; sectionLabel: string } | { state: 'sectionMissing'; articleRoute: string; title: string; sectionLabel: string } | { state: 'articleMissing'; title: string; sectionLabel: string } | { state: 'loading'; title: string; sectionLabel: string };

export type ArticleLookup = (articleId: string) => { title: string; sections: readonly string[] } | null | undefined;

export function resolveOrigin(origin: QuestionOrigin, lookup: ArticleLookup, sectionLabel: (key: string) => string | null): OriginView {
  const article = lookup(origin.articleId);
  const label = sectionLabel(origin.sectionKey) ?? origin.sectionLabel;
  if (article === undefined) return { state: 'loading', title: origin.articleTitle, sectionLabel: label };
  if (article === null) return { state: 'articleMissing', title: origin.articleTitle, sectionLabel: origin.sectionLabel };
  const articleRoute = `/culture/item/${encodeURIComponent(origin.articleId)}`;
  if (!article.sections.includes(origin.sectionKey)) return { state: 'sectionMissing', articleRoute, title: article.title, sectionLabel: origin.sectionLabel };
  return { state: 'live', route: `${articleRoute}?section=${encodeURIComponent(origin.sectionKey)}`, title: article.title, sectionLabel: label };
}

export function normalizeQuestions(raw: unknown): Questions {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Questions = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    const q = value as Partial<Question> | null;
    if (!q || typeof q !== 'object' || typeof q.text !== 'string' || !q.text.trim() || q.id !== id) continue;
    const origin = q.origin && typeof q.origin === 'object' && typeof q.origin.articleId === 'string' && typeof q.origin.sectionKey === 'string' ? { articleId: q.origin.articleId, sectionKey: q.origin.sectionKey, articleTitle: String(q.origin.articleTitle ?? ''), sectionLabel: String(q.origin.sectionLabel ?? '') } : null;
    const supports = Array.isArray(q.supports) ? q.supports.filter((s): s is SupportRef => !!s && typeof s.articleId === 'string').slice(0, MAX_SUPPORTS).map((s) => ({ articleId: s.articleId, title: String(s.title ?? '') })) : [];
    out[id] = {
      id,
      text: cleanText(q.text, QUESTION_MAX),
      origin,
      supports,
      answer: typeof q.answer === 'string' ? cleanText(q.answer, ANSWER_MAX) : '',
      status: q.status === 'answered' ? 'answered' : 'exploring',
      createdAt: typeof q.createdAt === 'string' ? q.createdAt : '',
      updatedAt: typeof q.updatedAt === 'string' ? q.updatedAt : '',
      answeredAt: q.status === 'answered' && typeof q.answeredAt === 'string' ? q.answeredAt : null,
    };
  }
  return out;
}

export const newQuestionId = () => `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
export const questionRoute = (id: string) => `/profile/questions/${encodeURIComponent(id)}`;

/* ---------- unsaved drafts (memory), per owner - survive opening a source ---------- */
const drafts = draftMap<string>('question');
export const draftKey = (owner: string, scope: string) => ownerKey(owner, scope);
export const getDraft = (owner: string, scope: string) => drafts.get(draftKey(owner, scope));
export const setDraft = (owner: string, scope: string, text: string | null) => {
  if (text === null) drafts.delete(draftKey(owner, scope));
  else drafts.set(draftKey(owner, scope), text);
};
/** Clear a draft only if it is still exactly what was sent (an edit typed while saving survives). */
export const clearDraftIfUnchanged = (owner: string, scope: string, sent: string) => {
  if (drafts.get(draftKey(owner, scope)) === sent) drafts.delete(draftKey(owner, scope));
};
