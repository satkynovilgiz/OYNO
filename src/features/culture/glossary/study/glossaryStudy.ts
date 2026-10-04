/**
 * Glossary Flashcards - a simple, calm REVIEW QUEUE over the existing
 * glossary (not a spaced-repetition algorithm, no scores, no rewards).
 * Cards are glossary entry ids only; the term and definition always come
 * from the live resolved glossary. Records hold counts and dates - never
 * definition text.
 */

export type StudyAction = 'got_it' | 'review_again';

export type GlossaryStudyRecord = {
  glossaryEntryId: string;
  seenCount: number;
  gotItCount: number;
  reviewAgainCount: number;
  lastReviewedAt: string;
  needsReview: boolean;
};

export type StudyData = Record<string, GlossaryStudyRecord>;

export const DEFAULT_SESSION_SIZE = 5;
export type SessionMode = 'five' | 'all' | 'review';

/** Small deterministic PRNG (mulberry32) so a session's order is stable
 * for its seed - never Math.random as the only rule. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffled<T>(list: readonly T[], seed: number): T[] {
  const random = seeded(seed);
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Terms marked "Review again" that are still valid glossary entries. */
export function reviewQueue(data: StudyData, validIds: readonly string[]): string[] {
  return validIds
    .filter((id) => data[id]?.needsReview)
    .sort((a, b) => data[a].lastReviewedAt.localeCompare(data[b].lastReviewedAt) || a.localeCompare(b));
}

/**
 * A session's cards, no duplicates, only VALID entries (stale records are
 * ignored): 1) "Review again" terms (longest waiting first), 2) terms never
 * studied (seeded shuffle - a first session is shuffled but reproducible),
 * 3) the rest, least recently reviewed first. 'review' = only queue 1.
 */
export function buildSession(validIds: readonly string[], data: StudyData, mode: SessionMode, seed: number): string[] {
  const unique = [...new Set(validIds)];
  const waiting = reviewQueue(data, unique);
  if (mode === 'review') return waiting;
  const fresh = shuffled(unique.filter((id) => !data[id]), seed);
  const seen = unique.filter((id) => data[id] && !data[id].needsReview).sort((a, b) => data[a].lastReviewedAt.localeCompare(data[b].lastReviewedAt) || a.localeCompare(b));
  const ordered = [...waiting, ...fresh, ...seen];
  return mode === 'all' ? ordered : ordered.slice(0, DEFAULT_SESSION_SIZE);
}

/** "Got it" clears the review flag; "Review again" sets it (the card comes
 * back in a FUTURE session - never looped immediately). */
export function applyAnswer(data: StudyData, glossaryEntryId: string, action: StudyAction, now = new Date()): StudyData {
  const previous = data[glossaryEntryId];
  return {
    ...data,
    [glossaryEntryId]: {
      glossaryEntryId,
      seenCount: (previous?.seenCount ?? 0) + 1,
      gotItCount: (previous?.gotItCount ?? 0) + (action === 'got_it' ? 1 : 0),
      reviewAgainCount: (previous?.reviewAgainCount ?? 0) + (action === 'review_again' ? 1 : 0),
      lastReviewedAt: now.toISOString(),
      needsReview: action === 'review_again',
    },
  };
}

/** Drops records for entries no longer in the valid glossary. */
export function pruneStudy(data: StudyData, validIds: readonly string[]): StudyData {
  const stale = Object.keys(data).filter((id) => !validIds.includes(id));
  if (stale.length === 0) return data;
  const next = { ...data };
  for (const id of stale) delete next[id];
  return next;
}

/** Guest -> account: counts summed, newest date, needsReview from the
 * newest action. */
export function mergeStudy(into: StudyData, from: StudyData): StudyData {
  const merged = { ...into };
  for (const [id, record] of Object.entries(from)) {
    const existing = merged[id];
    if (!existing) {
      merged[id] = record;
      continue;
    }
    const newest = record.lastReviewedAt > existing.lastReviewedAt ? record : existing;
    merged[id] = {
      glossaryEntryId: id,
      seenCount: existing.seenCount + record.seenCount,
      gotItCount: existing.gotItCount + record.gotItCount,
      reviewAgainCount: existing.reviewAgainCount + record.reviewAgainCount,
      lastReviewedAt: newest.lastReviewedAt,
      needsReview: newest.needsReview,
    };
  }
  return merged;
}

/** Session summary: plain counts (no grade, no percentage). */
export function sessionSummary(answers: readonly StudyAction[]): { reviewed: number; gotIt: number; reviewAgain: number } {
  return { reviewed: answers.length, gotIt: answers.filter((answer) => answer === 'got_it').length, reviewAgain: answers.filter((answer) => answer === 'review_again').length };
}
