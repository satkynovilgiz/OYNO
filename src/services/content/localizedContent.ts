import type { SupportedLanguage } from '@/i18n';

import type { CultureItemRow, CultureMaterialRow, ExploreRegionRow, QuestRow } from './types';

/**
 * The one resolver for long-form content in KG / RU / EN.
 *
 * Kyrgyz is the canonical text and lives in the content row itself.
 * RU / EN come from `content_translations` (reviewed rows only). Resolution
 * is always: requested language -> Kyrgyz, and every result says which one
 * the reader actually got, so a screen can show a small "only in Kyrgyz"
 * note instead of passing Kyrgyz off as Russian or English.
 *
 * A text body is never mixed: either every authored field of an article
 * (or every fact of a destination) exists in the requested language, or
 * the whole body stays Kyrgyz. The title may be localized on its own.
 */
export type TranslatedContentType = 'culture_item' | 'culture_material' | 'explore_region' | 'quest';

export type TranslationRow = {
  content_type: TranslatedContentType;
  content_id: string;
  language: 'ru' | 'en';
  field: string;
  value: string;
};

/** Internal state only - never shown to people as-is.
 *  available       the body is in the requested language (or it is KG)
 *  fallback_to_kg  the body is shown in Kyrgyz because no reviewed
 *                  translation exists yet
 *  missing         there is no authored body at all */
export type TranslationStatus = 'available' | 'fallback_to_kg' | 'missing';

export type TranslationMeta = {
  language: SupportedLanguage;
  status: TranslationStatus;
  titleLocalized: boolean;
  /** Every language's title that exists - for Search. */
  titles: Partial<Record<SupportedLanguage, string>>;
};

export type TranslationIndex = ReadonlyMap<string, string>;

export const EMPTY_TRANSLATIONS: TranslationIndex = new Map();

function key(type: TranslatedContentType, id: string, language: string, field: string): string {
  return `${type}|${id}|${language}|${field}`;
}

export function buildTranslationIndex(rows: readonly TranslationRow[]): TranslationIndex {
  const index = new Map<string, string>();
  for (const row of rows) if (row.value?.trim()) index.set(key(row.content_type, row.content_id, row.language, row.field), row.value);
  return index;
}

function lookup(index: TranslationIndex, type: TranslatedContentType, id: string, language: SupportedLanguage, field: string): string | undefined {
  return language === 'kg' ? undefined : index.get(key(type, id, language, field));
}

function titlesOf(index: TranslationIndex, type: TranslatedContentType, id: string, kgTitle: string): Partial<Record<SupportedLanguage, string>> {
  const titles: Partial<Record<SupportedLanguage, string>> = { kg: kgTitle };
  for (const language of ['ru', 'en'] as const) {
    const value = index.get(key(type, id, language, 'title'));
    if (value) titles[language] = value;
  }
  return titles;
}

/** Localizes a set of text fields all-or-nothing. */
function localizeBody<T extends Record<string, unknown>>(
  row: T,
  fields: readonly (keyof T & string)[],
  type: TranslatedContentType,
  id: string,
  language: SupportedLanguage,
  index: TranslationIndex,
): { patch: Partial<T>; status: TranslationStatus } {
  const authored = fields.filter((field) => typeof row[field] === 'string' && (row[field] as string).trim());
  if (authored.length === 0) return { patch: {}, status: 'missing' };
  if (language === 'kg') return { patch: {}, status: 'available' };
  const values = authored.map((field) => lookup(index, type, id, language, field));
  if (values.some((value) => !value)) return { patch: {}, status: 'fallback_to_kg' };
  const patch: Partial<T> = {};
  authored.forEach((field, position) => ((patch as Record<string, unknown>)[field] = values[position]));
  return { patch, status: 'available' };
}

export const CULTURE_ITEM_BODY_FIELDS = [
  'origin',
  'history',
  'cultural_meaning',
  'when_used',
  'ingredients',
  'traditional_method',
  'who_participates',
  'objects_used',
  'regional_notes',
  'modern_status',
  'fun_facts',
] as const satisfies readonly (keyof CultureItemRow)[];

export function localizeCultureItem(item: CultureItemRow, language: SupportedLanguage, index: TranslationIndex): CultureItemRow {
  const title = lookup(index, 'culture_item', item.id, language, 'title');
  const altNames = lookup(index, 'culture_item', item.id, language, 'alt_names');
  const { patch, status } = localizeBody(item, CULTURE_ITEM_BODY_FIELDS, 'culture_item', item.id, language, index);
  return {
    ...item,
    ...patch,
    title: title ?? item.title,
    alt_names: altNames ?? item.alt_names,
    translation: { language, status, titleLocalized: language === 'kg' || !!title, titles: titlesOf(index, 'culture_item', item.id, item.title) },
  };
}

export function localizeMaterial(material: CultureMaterialRow, language: SupportedLanguage, index: TranslationIndex): CultureMaterialRow {
  const title = lookup(index, 'culture_material', material.id, language, 'title');
  const { patch, status } = localizeBody(material, ['description', 'body'] as const, 'culture_material', material.id, language, index);
  return {
    ...material,
    ...patch,
    title: title ?? material.title,
    translation: { language, status, titleLocalized: language === 'kg' || !!title, titles: titlesOf(index, 'culture_material', material.id, material.title) },
  };
}

/** Destination facts: all facts in the requested language, or all Kyrgyz. */
export function localizeRegionFacts(region: ExploreRegionRow, language: SupportedLanguage, index: TranslationIndex): { facts: string[]; status: TranslationStatus } {
  if (region.facts.length === 0) return { facts: [], status: 'missing' };
  if (language === 'kg') return { facts: region.facts, status: 'available' };
  const translated = region.facts.map((_, position) => lookup(index, 'explore_region', region.id, language, `fact.${position}`));
  return translated.every(Boolean) ? { facts: translated as string[], status: 'available' } : { facts: region.facts, status: 'fallback_to_kg' };
}

export function localizeQuest(quest: QuestRow, language: SupportedLanguage, index: TranslationIndex): QuestRow {
  const { patch, status } = localizeBody(quest, ['title', 'subtitle', 'cta_label'] as const, 'quest', quest.id, language, index);
  return { ...quest, ...patch, translation: { language, status, titleLocalized: status === 'available', titles: titlesOf(index, 'quest', quest.id, quest.title) } };
}

/** Row-level wrapper for the hooks: facts replaced when fully translated,
 * plus which language they are in. */
export function localizeRegion(region: ExploreRegionRow, language: SupportedLanguage, index: TranslationIndex): ExploreRegionRow {
  const { facts, status } = localizeRegionFacts(region, language, index);
  return { ...region, facts, factsTranslation: status };
}
