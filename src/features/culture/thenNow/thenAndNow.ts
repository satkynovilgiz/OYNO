import type { AgeExperience } from '@/services/ageExperience/types';
import type { CultureItemRow } from '@/services/content/types';

/**
 * Culture Then & Now - PRESENTATION of fields an editor already wrote and
 * sourced. Nothing here writes, summarizes or dates anything: each side is
 * the authored text of real fields, shown as-is. Eligibility is derived
 * from the fields every time (no stored flag), so removing modern_status in
 * the Admin Content Studio removes the module.
 */

/** Clearly historical / traditional fields, in reading order. */
export const THEN_FIELDS = ['history', 'origin', 'traditional_method'] as const;
/** Clearly modern fields. (when_used is excluded - it can describe either.) */
export const NOW_FIELDS = ['modern_status'] as const;

export type ThenNowField = (typeof THEN_FIELDS)[number] | (typeof NOW_FIELDS)[number];
export type ThenNowPart = { field: ThenNowField; text: string };
export type ThenAndNow = { then: ThenNowPart[]; now: ThenNowPart[] };

function parts(item: CultureItemRow, fields: readonly ThenNowField[]): ThenNowPart[] {
  return fields.flatMap((field) => {
    const text = typeof item[field] === 'string' ? (item[field] as string).trim() : '';
    return text ? [{ field, text }] : [];
  });
}

/** Null unless there is at least one real Then field AND a real Now field. */
export function thenAndNowFor(item: CultureItemRow): ThenAndNow | null {
  const then = parts(item, THEN_FIELDS);
  const now = parts(item, NOW_FIELDS);
  return then.length > 0 && now.length > 0 ? { then, now } : null;
}

/** One model, different presentation per age: heading wording and how
 * much of each excerpt shows on the article (visual truncation only). */
export const THEN_NOW_PRESENTATION: Record<AgeExperience, { headings: 'simple' | 'standard'; excerptLines: number; editorial: boolean }> = {
  child: { headings: 'simple', excerptLines: 2, editorial: false },
  preteen: { headings: 'simple', excerptLines: 3, editorial: false },
  teen: { headings: 'standard', excerptLines: 4, editorial: false },
  adult: { headings: 'standard', excerptLines: 5, editorial: true },
};

export function thenNowRoute(itemId: string): string {
  return `/culture/item/${itemId}/then-now`;
}

/** The existing article label for each field (culture.item.*Label). */
export const FIELD_LABEL_KEY: Record<ThenNowField, string> = {
  history: 'culture.item.historyLabel',
  origin: 'culture.item.originLabel',
  traditional_method: 'culture.item.traditionalMethodLabel',
  modern_status: 'culture.item.modernStatusLabel',
};
