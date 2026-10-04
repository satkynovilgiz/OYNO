import type { AgeExperience } from '@/services/ageExperience/types';

/**
 * Journal Guided Prompts 1.0 - optional, hand-authored writing ideas.
 *
 * Bundled (works offline), reviewed KG/RU/EN copy under
 * `journalPrompts.items.<id>`. No AI, no generated prompts, no mood or
 * emotion analysis, no therapy framing. A prompt is only helper text in
 * the editor: it is never written into the note and never stored with
 * the entry - the person's own words are the memory.
 */

export const PROMPT_CATEGORIES = ['memory', 'culture', 'family', 'place', 'learning'] as const;
export type PromptCategory = (typeof PROMPT_CATEGORIES)[number];

export type JournalPrompt = {
  id: string;
  category: PromptCategory;
  /** i18n key of the prompt text (KG/RU/EN). */
  textKey: string;
  /** Who sees it: child = simple and concrete; preteen = short reflective;
   * teen = open-ended; adult = compact. */
  ageModes: readonly AgeExperience[];
};

const ALL: readonly AgeExperience[] = ['child', 'preteen', 'teen', 'adult'];
const YOUNG: readonly AgeExperience[] = ['child', 'preteen'];
const OLDER: readonly AgeExperience[] = ['teen', 'adult'];

const prompt = (id: string, category: PromptCategory, ageModes: readonly AgeExperience[]): JournalPrompt => ({ id, category, textKey: `journalPrompts.items.${id}`, ageModes });

export const JOURNAL_PROMPTS: readonly JournalPrompt[] = [
  prompt('m-favorite-moment', 'memory', YOUNG),
  prompt('m-remember-tradition', 'memory', ALL),
  prompt('m-object-story', 'memory', OLDER),
  prompt('m-sound-smell', 'memory', OLDER),
  prompt('c-learned-today', 'culture', ALL),
  prompt('c-try-craft', 'culture', YOUNG),
  prompt('c-word', 'culture', ['preteen', 'teen', 'adult']),
  prompt('c-ask-elder', 'culture', OLDER),
  prompt('f-cook-together', 'family', YOUNG),
  prompt('f-family-story', 'family', ALL),
  prompt('f-celebration', 'family', ['preteen', 'teen']),
  prompt('f-learned-from-elder', 'family', OLDER),
  prompt('p-important-place', 'place', ALL),
  prompt('p-outside-today', 'place', YOUNG),
  prompt('p-want-to-visit', 'place', OLDER),
  prompt('p-small-detail', 'place', OLDER),
  prompt('l-new-thing', 'learning', YOUNG),
  prompt('l-surprise', 'learning', ALL),
  prompt('l-practicing', 'learning', ['preteen', 'teen']),
  prompt('l-changed-mind', 'learning', OLDER),
];

/** The prompt a Culture article's "Add to Journal" offers (generic - never a factual claim). */
export const CULTURE_REFLECTION_PROMPT = 'c-learned-today';

export function getPrompt(id: string | null | undefined): JournalPrompt | null {
  return (id && JOURNAL_PROMPTS.find((candidate) => candidate.id === id)) || null;
}

/** Prompts for this age mode, optionally one category, in authored order. */
export function promptsFor(experience: AgeExperience, category: PromptCategory | null = null, prompts: readonly JournalPrompt[] = JOURNAL_PROMPTS): JournalPrompt[] {
  return prompts.filter((candidate) => candidate.ageModes.includes(experience) && (!category || candidate.category === category));
}

/** Small deterministic hash (FNV-1a) - same seed, same order; no Math.random. */
function hash(text: string): number {
  let value = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value;
}

/** A stable shuffled order for a seed (e.g. today's date). */
export function shuffledOrder(pool: readonly JournalPrompt[], seed: string): JournalPrompt[] {
  return [...pool].sort((a, b) => hash(`${seed}:${a.id}`) - hash(`${seed}:${b.id}`) || a.id.localeCompare(b.id));
}

/**
 * "Another prompt": the next prompt in the seed's shuffled order after the
 * current one, wrapping around - so every prompt comes up before any
 * repeats, and the same prompt never appears twice in a row (when there
 * is more than one). No server request.
 */
export function nextPrompt(pool: readonly JournalPrompt[], currentId: string | null, seed: string): JournalPrompt | null {
  const order = shuffledOrder(pool, seed);
  if (order.length === 0) return null;
  const index = currentId ? order.findIndex((candidate) => candidate.id === currentId) : -1;
  return order[(index + 1) % order.length];
}
