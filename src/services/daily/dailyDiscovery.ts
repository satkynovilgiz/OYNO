import type { CultureItemRow } from '@/services/content/types';

/**
 * Pure selection logic for "Daily OYNO" (Today's Discovery). Everything
 * here picks from real `culture_items` rows the app already loads - it
 * never writes, generates or paraphrases cultural text (spec "Do NOT
 * generate random fake cultural facts... Everything must come from
 * verified/existing OYNO content"). Kept free of React/AsyncStorage so
 * the day-to-day rotation is unit-testable.
 */

/** Text fields a daily discovery can show, in the order they're preferred.
 * Mirrors the field list CultureItemDetailScreen already renders. */
export const DAILY_TEXT_FIELDS = ['cultural_meaning', 'history', 'origin', 'fun_facts', 'when_used', 'regional_notes'] as const;
export type DailyTextField = (typeof DAILY_TEXT_FIELDS)[number];

/** The user's LOCAL calendar date as YYYY-MM-DD (spec "Persist completion
 * by local calendar date") - deliberately not `toISOString()`, which is
 * UTC and would flip the day at the wrong hour for Kyrgyzstan (UTC+6). */
export function localDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Whole days since 1970-01-01 for a YYYY-MM-DD key - timezone-free, so
 * the same key always maps to the same rotation slot. */
export function dayNumber(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** FNV-1a - a small stable string hash, used only to shuffle the pool into
 * a fixed order so consecutive days don't walk one category at a time. */
function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function hasDailyText(item: CultureItemRow): boolean {
  return DAILY_TEXT_FIELDS.some((field) => !!item[field]?.trim());
}

/**
 * Items eligible to be a day's discovery: a real bundled photo (so the
 * card/screen/challenge always has real artwork), at least one authored
 * text field (so name-only stub rows never show up as an empty
 * "discovery"), and not flagged `unverified` - the daily card presents
 * its item as *the* fact of the day, so it only draws from content that
 * has had at least a partial verification pass. Returned in a stable
 * hash order.
 */
export function dailyDiscoveryPool(items: CultureItemRow[], hasImage: (itemId: string) => boolean): CultureItemRow[] {
  return items
    .filter((item) => item.accuracy_level !== 'unverified' && hasImage(item.id) && hasDailyText(item))
    .sort((a, b) => hashString(a.id) - hashString(b.id) || a.id.localeCompare(b.id));
}

/** Same item for everyone on the same local date, a different one the next
 * day, and no repeats until the whole pool has been cycled through. */
export function pickDailyDiscovery(pool: CultureItemRow[], dateKey: string): CultureItemRow | null {
  if (pool.length === 0) return null;
  return pool[dayNumber(dateKey) % pool.length];
}

/** Rough reading time for the text actually shown - an honest estimate
 * (~150 words/minute), clamped to the 1-3 minute experience the spec
 * asks for rather than a made-up fixed number. */
export function estimateReadMinutes(texts: (string | null | undefined)[]): number {
  const words = texts.reduce((sum, text) => sum + (text?.trim() ? text.trim().split(/\s+/).length : 0), 0);
  return Math.min(3, Math.max(1, Math.ceil(words / 150)));
}

export type DailyChallengeOption = { itemId: string; correct: boolean };

/**
 * "Which picture is <title>?" - a tiny visual challenge built only from
 * real photos already bundled for real items: the answer's own photo plus
 * distractors from other items, never an invented question. Distractors
 * must show a *different* photo than the answer and each other (several
 * clothing items share one panel photo, which would make the question
 * unanswerable), and prefer other categories so the choice is clear.
 * Option order is shuffled deterministically per day.
 */
export function buildImageChallenge(
  answer: CultureItemRow,
  pool: CultureItemRow[],
  dateKey: string,
  imageOf: (itemId: string) => unknown,
  optionCount = 3,
): DailyChallengeOption[] {
  const answerImage = imageOf(answer.id);
  const usedImages = new Set<unknown>([answerImage]);
  const seed = dayNumber(dateKey);

  const candidates = pool
    .filter((item) => item.id !== answer.id)
    .sort((a, b) => {
      const aSameCategory = a.category_id === answer.category_id ? 1 : 0;
      const bSameCategory = b.category_id === answer.category_id ? 1 : 0;
      return aSameCategory - bSameCategory || hashString(`${seed}:${a.id}`) - hashString(`${seed}:${b.id}`);
    });

  const distractors: CultureItemRow[] = [];
  for (const candidate of candidates) {
    if (distractors.length >= optionCount - 1) break;
    const image = imageOf(candidate.id);
    if (!image || usedImages.has(image)) continue;
    usedImages.add(image);
    distractors.push(candidate);
  }

  return [answer, ...distractors]
    .map((item) => ({ itemId: item.id, correct: item.id === answer.id }))
    .sort((a, b) => hashString(`${dateKey}:${a.itemId}`) - hashString(`${dateKey}:${b.itemId}`));
}
