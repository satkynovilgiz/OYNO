import type { CultureItemRow } from '@/services/content/types';

/**
 * The authored sections of a culture item article, in display order - the
 * SAME keys the article renders, the Reader Navigator, Read & Listen,
 * highlights and section bookmarks use.
 */
export const DETAIL_FIELDS: { key: keyof CultureItemRow; labelKey: string }[] = [
  { key: 'origin', labelKey: 'culture.item.originLabel' },
  { key: 'history', labelKey: 'culture.item.historyLabel' },
  { key: 'cultural_meaning', labelKey: 'culture.item.culturalMeaningLabel' },
  { key: 'when_used', labelKey: 'culture.item.whenUsedLabel' },
  { key: 'ingredients', labelKey: 'culture.item.ingredientsLabel' },
  { key: 'traditional_method', labelKey: 'culture.item.traditionalMethodLabel' },
  { key: 'who_participates', labelKey: 'culture.item.whoParticipatesLabel' },
  { key: 'objects_used', labelKey: 'culture.item.objectsUsedLabel' },
  { key: 'regional_notes', labelKey: 'culture.item.regionalNotesLabel' },
  { key: 'modern_status', labelKey: 'culture.item.modernStatusLabel' },
  { key: 'fun_facts', labelKey: 'culture.item.funFactsLabel' },
];

/** The section keys the article renders for this item now (non-empty fields, standard depth). */
export const renderedSectionKeys = (item: CultureItemRow): string[] => DETAIL_FIELDS.filter((field) => !!item[field.key]).map((field) => field.key as string);
export const sectionLabelKey = (key: string): string | null => DETAIL_FIELDS.find((field) => field.key === key)?.labelKey ?? null;
