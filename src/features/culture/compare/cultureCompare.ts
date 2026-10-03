import type { AgeExperience } from '@/services/ageExperience/types';
import type { CultureItemRow } from '@/services/content/types';

/**
 * Culture Compare - CURATED pairs only. Each side shows its own authored
 * field text, as-is, under the same heading; the reader compares. Nothing
 * here writes a difference, ranks the two, or merges their sources. A field
 * appears only when BOTH items really have text for it (checked live, so
 * an editor clearing a field hides it).
 */

export const COMPARE_FIELDS = ['origin', 'history', 'cultural_meaning', 'when_used', 'traditional_method', 'objects_used', 'modern_status'] as const;
export type CompareField = (typeof COMPARE_FIELDS)[number];

export type CultureComparison = {
  id: string;
  leftItemId: string;
  rightItemId: string;
  /** In reading order; only fields BOTH items authored (verified when the pair was curated). */
  fields: CompareField[];
  /** The 2-3 simplest fields for the child experience (a subset of `fields`). */
  childFields: CompareField[];
};

/**
 * Curated after reading the real rows (2026-10-02). Every listed field has
 * substantial authored text on both sides; both items have approved
 * bundled images. Pairs considered and EXCLUDED: Ат чабыш / Жорго салыш and
 * Оодарыш / Тыйын эңмей (no approved image for Жорго салыш / Тыйын эңмей).
 */
export const CULTURE_COMPARISONS: readonly CultureComparison[] = [
  {
    id: 'shyrdak-ala-kiyiz',
    leftItemId: 'shyrdak-craft',
    rightItemId: 'shyrdak-ala-kiyiz',
    fields: ['origin', 'traditional_method', 'modern_status'],
    childFields: ['origin', 'traditional_method'],
  },
  {
    id: 'kok-boru-kyz-kuumai',
    leftItemId: 'horse-kok-boru',
    rightItemId: 'horse-kyz-kuumai',
    fields: ['origin', 'history', 'cultural_meaning', 'when_used', 'traditional_method', 'objects_used', 'modern_status'],
    childFields: ['cultural_meaning', 'when_used', 'objects_used'],
  },
  {
    id: 'kok-boru-oodarysh',
    leftItemId: 'horse-kok-boru',
    rightItemId: 'horse-oodarysh',
    fields: ['origin', 'history', 'cultural_meaning', 'when_used', 'traditional_method', 'objects_used', 'modern_status'],
    childFields: ['cultural_meaning', 'when_used', 'objects_used'],
  },
  {
    id: 'ak-kalpak-tebetey',
    leftItemId: 'clothing-ak-kalpak',
    rightItemId: 'clothing-tebetey',
    fields: ['cultural_meaning', 'when_used', 'objects_used'],
    childFields: ['when_used', 'objects_used'],
  },
];

export function comparisonById(id: string | undefined): CultureComparison | null {
  return CULTURE_COMPARISONS.find((pair) => pair.id === id) ?? null;
}

export function compareRoute(id: string): string {
  return `/culture/compare/${id}`;
}

const textOf = (item: CultureItemRow, field: CompareField): string => (typeof item[field] === 'string' ? (item[field] as string).trim() : '');

export type CompareRow = { field: CompareField; left: string; right: string };

/** The rows to show: configured fields (age-limited) that BOTH sides have. */
export function compareRows(pair: CultureComparison, left: CultureItemRow, right: CultureItemRow, age: AgeExperience): CompareRow[] {
  const fields = age === 'child' ? pair.childFields : pair.fields;
  return fields.flatMap((field) => {
    const a = textOf(left, field);
    const b = textOf(right, field);
    return a && b ? [{ field, left: a, right: b }] : [];
  });
}

/** Same facts for everyone; only how many fields and how they look. */
export const COMPARE_PRESENTATION: Record<AgeExperience, { maxFields: number; largeImages: boolean; editorial: boolean }> = {
  child: { maxFields: 3, largeImages: true, editorial: false },
  preteen: { maxFields: 7, largeImages: true, editorial: false },
  teen: { maxFields: 7, largeImages: false, editorial: false },
  adult: { maxFields: 7, largeImages: false, editorial: true },
};

/** The existing article label for each field (culture.item.*Label). */
export const COMPARE_LABEL_KEY: Record<CompareField, string> = {
  origin: 'culture.item.originLabel',
  history: 'culture.item.historyLabel',
  cultural_meaning: 'culture.item.culturalMeaningLabel',
  when_used: 'culture.item.whenUsedLabel',
  traditional_method: 'culture.item.traditionalMethodLabel',
  objects_used: 'culture.item.objectsUsedLabel',
  modern_status: 'culture.item.modernStatusLabel',
};

/**
 * Integrity: both ids exist, both have an image, every configured field
 * has text on both, child fields are a 2-3 subset, no duplicate pair (in
 * either order), ids are route-safe.
 */
export function validateComparisons(
  pairs: readonly CultureComparison[],
  items: readonly CultureItemRow[],
  hasImage: (itemId: string) => boolean,
): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  const byId = new Map(items.map((item) => [item.id, item]));
  for (const pair of pairs) {
    if (!/^[a-z0-9-]+$/.test(pair.id)) problems.push(`${pair.id}: id not route-safe`);
    const key = [pair.leftItemId, pair.rightItemId].sort().join('|');
    if (seen.has(key) || pairs.filter((other) => other.id === pair.id).length > 1) problems.push(`${pair.id}: duplicate pair`);
    seen.add(key);
    if (pair.leftItemId === pair.rightItemId) problems.push(`${pair.id}: compares an item with itself`);
    for (const itemId of [pair.leftItemId, pair.rightItemId]) {
      const item = byId.get(itemId);
      if (!item) {
        problems.push(`${pair.id}: missing item ${itemId}`);
        continue;
      }
      if (!hasImage(itemId)) problems.push(`${pair.id}: no image for ${itemId}`);
      for (const field of pair.fields) if (!textOf(item, field)) problems.push(`${pair.id}: ${itemId} has no ${field}`);
    }
    if (pair.fields.length === 0) problems.push(`${pair.id}: no fields`);
    if (pair.childFields.length < 2 || pair.childFields.length > 3 || pair.childFields.some((field) => !pair.fields.includes(field))) problems.push(`${pair.id}: child fields must be 2-3 of its fields`);
  }
  if (pairs.length > 5) problems.push('more than 5 pairs');
  return problems;
}
