import { draftMap, ownerKey } from '@/services/drafts/draftRegistry';

/**
 * "Explain it yourself" - the reader's own explanation of one article.
 * Never graded, never checked against the article, never called mastery.
 * One entry per owner + article id (saving is an update, so it can't make
 * duplicates). The saved text stays exactly as it was until a revision has
 * been written successfully. Title snapshot kept for removed articles.
 */
export const EXPLANATION_MAX = 1200;
/** Reviewed, neutral prompts - they ask for the reader's words and add no facts. */
export const PROMPTS = ['friend', 'mainIdea', 'noticed'] as const;
export type PromptId = (typeof PROMPTS)[number];

export type Explanation = { articleId: string; titleSnapshot: string; promptId: PromptId; text: string; createdAt: string; updatedAt: string; revisions: number };
export type Explanations = Record<string, Explanation>;

export const cleanExplanation = (text: string) => text.replace(/[<>{}]/g, '').slice(0, EXPLANATION_MAX);
export const isValidExplanation = (text: string) => text.trim().length > 0 && text.length <= EXPLANATION_MAX;

/** The saved entry after a successful save of `text` (a new one, or a revision). */
export function saveExplanation(existing: Explanation | undefined, input: { articleId: string; titleSnapshot: string; promptId: PromptId; text: string }, now: string): Explanation {
  const text = cleanExplanation(input.text).replace(/\s+$/, '');
  if (!existing) return { articleId: input.articleId, titleSnapshot: input.titleSnapshot.slice(0, 160), promptId: input.promptId, text, createdAt: now, updatedAt: now, revisions: 0 };
  if (existing.text === text && existing.promptId === input.promptId) return existing;
  return { ...existing, titleSnapshot: input.titleSnapshot.slice(0, 160) || existing.titleSnapshot, promptId: input.promptId, text, updatedAt: now, revisions: existing.revisions + 1 };
}

export function normalizeExplanations(raw: unknown): Explanations {
  const out: Explanations = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [id, value] of Object.entries(raw as Record<string, Partial<Explanation>>)) {
    if (!value || value.articleId !== id || typeof value.text !== 'string' || !value.text.trim()) continue;
    out[id] = { articleId: id, titleSnapshot: String(value.titleSnapshot ?? '').slice(0, 160), promptId: (PROMPTS as readonly string[]).includes(String(value.promptId)) ? (value.promptId as PromptId) : 'friend', text: cleanExplanation(value.text), createdAt: String(value.createdAt ?? ''), updatedAt: String(value.updatedAt ?? ''), revisions: Number.isInteger(value.revisions) ? (value.revisions as number) : 0 };
  }
  return out;
}

/* ---------- unsaved drafts (memory, shared registry - also listed in the Recovery Center) ---------- */
export type ExplainDraft = { text: string; promptId: PromptId; titleSnapshot: string };
const drafts = draftMap<ExplainDraft>('explanation');
export const explainDraft = (owner: string, articleId: string) => drafts.get(ownerKey(owner, articleId)) ?? null;
export const setExplainDraft = (owner: string, articleId: string, draft: ExplainDraft | null) => (draft ? drafts.set(ownerKey(owner, articleId), draft) : drafts.delete(ownerKey(owner, articleId)));
/** Only clears what was sent - anything typed while saving stays as the draft. */
export const clearExplainDraftIfUnchanged = (owner: string, articleId: string, sent: ExplainDraft) => {
  if (drafts.get(ownerKey(owner, articleId)) === sent) drafts.delete(ownerKey(owner, articleId));
};
export const explainRoute = (articleId: string) => `/culture/item/${encodeURIComponent(articleId)}/explain`;
