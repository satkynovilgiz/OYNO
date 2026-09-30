import type { SupportedLanguage } from '@/i18n';
import {
  buildTranslationIndex,
  CULTURE_ITEM_BODY_FIELDS,
  localizeCultureItem,
  localizeMaterial,
  localizeQuest,
  localizeRegionFacts,
  type TranslatedContentType,
  type TranslationStatus,
} from '@/services/content/localizedContent';
import type { CultureItemRow, CultureMaterialRow, ExploreRegionRow, QuestRow } from '@/services/content/types';

import type { AdminRow, AdminSectionConfig } from './sections';

/**
 * Admin Content Studio - pure rules behind the list, filters, translation
 * coverage and save validation. No UI, no network: everything here is
 * computed from rows the admin screens already fetched.
 */

export type Coverage = 'complete' | 'partial' | 'missing';
export type LanguageCoverage = Record<'kg' | 'ru' | 'en', Coverage>;

/** A content_translations row as returned by admin_get_content_translations. */
export type AdminTranslationRow = {
  id: string;
  content_type: TranslatedContentType;
  content_id: string;
  language: 'ru' | 'en';
  field: string;
  value: string;
  status: 'draft' | 'reviewed';
  updated_at?: string | null;
};

const MATERIAL_FIELDS = ['title', 'description', 'body'] as const;
const QUEST_FIELDS = ['title', 'subtitle', 'cta_label'] as const;

function filled(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * The fields of one row that carry Kyrgyz text and therefore need a RU/EN
 * translation - only fields the Kyrgyz row actually fills.
 */
export function translatableFields(contentType: TranslatedContentType, row: AdminRow): string[] {
  if (contentType === 'culture_item') return ['title', 'alt_names', ...CULTURE_ITEM_BODY_FIELDS].filter((field) => filled(row[field]));
  if (contentType === 'culture_material') return MATERIAL_FIELDS.filter((field) => filled(row[field]));
  if (contentType === 'quest') return QUEST_FIELDS.filter((field) => filled(row[field]));
  const facts = Array.isArray(row.facts) ? (row.facts as unknown[]) : [];
  return facts.map((fact, index) => (filled(fact) ? `fact.${index}` : null)).filter((field): field is string => !!field);
}

/** The Kyrgyz source text of one translatable field. */
export function kyrgyzSourceOf(row: AdminRow, field: string): string {
  const fact = /^fact\.(\d+)$/.exec(field);
  if (fact) return String((row.facts as unknown[] | undefined)?.[Number(fact[1])] ?? '');
  return String(row[field] ?? '');
}

/**
 * Real KG/RU/EN coverage for one row. Kyrgyz is canonical: complete when it
 * has a title and body text. RU/EN count only non-empty REVIEWED
 * translations - a draft (or a row existing) never makes a language
 * "complete": complete = every Kyrgyz field reviewed, partial = anything
 * started, missing = nothing.
 */
export function coverageFor(contentType: TranslatedContentType, row: AdminRow, translations: readonly AdminTranslationRow[]): LanguageCoverage {
  const fields = translatableFields(contentType, row);
  const hasTitle = contentType === 'explore_region' ? filled(row.name_kg) : fields.includes('title');
  const hasBody = fields.some((field) => field !== 'title' && field !== 'alt_names');
  const kg: Coverage = hasTitle && hasBody ? 'complete' : hasTitle || hasBody ? 'partial' : 'missing';

  const id = String(row.id ?? '');
  const mine = translations.filter((translation) => translation.content_type === contentType && translation.content_id === id);
  const coverage = (language: 'ru' | 'en'): Coverage => {
    const inLanguage = mine.filter((translation) => translation.language === language && filled(translation.value));
    // Destinations keep their RU/EN names on the row itself.
    const nameDone = contentType !== 'explore_region' || filled(row[`name_${language}`]);
    if (fields.length === 0) return nameDone && contentType === 'explore_region' && filled(row.name_kg) ? 'complete' : 'missing';
    const reviewed = new Set(inLanguage.filter((translation) => translation.status === 'reviewed').map((translation) => translation.field));
    if (nameDone && fields.every((field) => reviewed.has(field))) return 'complete';
    return inLanguage.length > 0 || (contentType === 'explore_region' && nameDone) ? 'partial' : 'missing';
  };
  return { kg, ru: coverage('ru'), en: coverage('en') };
}

export type VerificationLevel = 'verified' | 'partially_verified' | 'unverified';

export function verificationOf(section: AdminSectionConfig, row: AdminRow): VerificationLevel | null {
  if (!section.verificationField) return null;
  const value = row[section.verificationField];
  return value === 'verified' || value === 'partially_verified' ? value : 'unverified';
}

export type AdminFilter = {
  query: string;
  verification: VerificationLevel | 'all';
  /** e.g. { language: 'ru', coverage: 'missing' } */
  localization: { language: 'ru' | 'en'; coverage: Coverage } | null;
};

export const EMPTY_FILTER: AdminFilter = { query: '', verification: 'all', localization: null };

/** Title / id search plus verification and localization filters. */
export function filterAdminRows(
  section: AdminSectionConfig,
  rows: readonly AdminRow[],
  filter: AdminFilter,
  coverageOf: (row: AdminRow) => LanguageCoverage | null,
): AdminRow[] {
  const query = filter.query.trim().toLowerCase();
  return rows.filter((row) => {
    if (query) {
      const haystack = `${String(row[section.idField] ?? '')} ${String(row[section.titleField] ?? '')}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    if (filter.verification !== 'all' && verificationOf(section, row) !== filter.verification) return false;
    if (filter.localization) {
      const coverage = coverageOf(row);
      if (!coverage || coverage[filter.localization.language] !== filter.localization.coverage) return false;
    }
    return true;
  });
}

/** A real, openable web address: http(s), a dotted host, no spaces. */
export function isValidSourceUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!/^https?:\/\/[^\s/?#]+\.[^\s/?#]+[^\s]*$/i.test(trimmed)) return false;
  try {
    // eslint-disable-next-line no-new
    new URL(trimmed);
    return true;
  } catch {
    return false;
  }
}

export function splitLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Known ids per linkable table, for broken-link checks. */
export type AdminCatalog = Partial<Record<'culture_items' | 'culture_materials' | 'explore_regions' | 'discoveries' | 'quests' | 'quiz_questions', ReadonlySet<string>>>;

/**
 * Everything that must be right before a save is sent: required fields,
 * valid source URLs, "verified" needs a source, and every linked id must
 * exist (a catalog that hasn't loaded yet is not treated as "missing").
 * Returns the first problem, or null.
 */
export function validateAdminValues(section: AdminSectionConfig, values: Record<string, string>, catalog: AdminCatalog): string | null {
  for (const field of section.fields) {
    if (field.required && !values[field.key]?.trim()) return `${field.label} is required.`;
  }
  for (const field of section.fields) {
    if (field.kind !== 'sources') continue;
    const bad = splitLines(values[field.key] ?? '').find((line) => !isValidSourceUrl(line));
    if (bad) return `Not a valid source URL: ${bad}`;
  }
  const custom = section.validate?.(values) ?? null;
  if (custom) return custom;
  for (const link of section.links?.(values) ?? []) {
    const id = values[link.field]?.trim();
    if (!id) continue;
    const known = catalog[link.table];
    if (known && !known.has(id)) return `${link.label}: "${id}" doesn't exist in ${link.table}.`;
  }
  return null;
}

/** Any field differs from what was loaded. */
export function isDirty(initial: Record<string, string>, current: Record<string, string>): boolean {
  const keys = new Set([...Object.keys(initial), ...Object.keys(current)]);
  for (const key of keys) if ((initial[key] ?? '') !== (current[key] ?? '')) return true;
  return false;
}

/** Validation for one translation before it is saved. */
export function validateTranslation(value: string, status: 'draft' | 'reviewed'): string | null {
  if (!value.trim()) return 'Translation is empty - write it, or leave the field untouched.';
  if (status !== 'draft' && status !== 'reviewed') return 'Unknown status.';
  return null;
}

export type ContentPreview = {
  title: string;
  blocks: { field: string; text: string }[];
  /** What the app will do for this language right now. */
  status: TranslationStatus;
};

/**
 * How the row reads in one language IN THE APP - built with the same
 * resolvers the app uses, from reviewed translations only (drafts never
 * show). So an incomplete RU body previews as the Kyrgyz fallback, exactly
 * as a reader would see it.
 */
export function previewFor(contentType: TranslatedContentType, row: AdminRow, language: SupportedLanguage, translations: readonly AdminTranslationRow[]): ContentPreview {
  const index = buildTranslationIndex(translations.filter((translation) => translation.status === 'reviewed'));
  if (contentType === 'culture_item') {
    const item = localizeCultureItem(row as unknown as CultureItemRow, language, index);
    const blocks = CULTURE_ITEM_BODY_FIELDS.filter((field) => filled(item[field])).map((field) => ({ field, text: String(item[field]) }));
    return { title: item.title, blocks, status: item.translation?.status ?? 'missing' };
  }
  if (contentType === 'culture_material') {
    const material = localizeMaterial(row as unknown as CultureMaterialRow, language, index);
    const blocks = (['description', 'body'] as const).filter((field) => filled(material[field])).map((field) => ({ field, text: String(material[field]) }));
    return { title: material.title, blocks, status: material.translation?.status ?? 'missing' };
  }
  if (contentType === 'quest') {
    const quest = localizeQuest(row as unknown as QuestRow, language, index);
    const blocks = (['subtitle', 'cta_label'] as const).filter((field) => filled(quest[field])).map((field) => ({ field, text: String(quest[field]) }));
    return { title: quest.title, blocks, status: quest.translation?.status ?? 'missing' };
  }
  const region = row as unknown as ExploreRegionRow;
  const { facts, status } = localizeRegionFacts(region, language, index);
  const name = String((row as Record<string, unknown>)[`name_${language}`] || row.name_kg || '');
  return { title: name, blocks: facts.map((text, position) => ({ field: `fact.${position}`, text })), status };
}

/** The editor's string form values back as a row (arrays split per line),
 * so coverage and preview reflect unsaved edits too. */
export function valuesToRow(section: AdminSectionConfig, values: Record<string, string>): AdminRow {
  const row: AdminRow = {};
  for (const field of section.fields) row[field.key] = field.type === 'array' ? splitLines(values[field.key] ?? '') : (values[field.key] ?? '');
  return row;
}


/** The inbox's admin-only error line: a clear pointer when the feedback v2
 * migration isn't applied yet (PostgREST "function not found"), otherwise
 * the short server message - never a stack or a secret. */
export const FEEDBACK_INBOX_LIMIT = 200;
export function feedbackInboxError(error: { message?: string; code?: string } | null | undefined): string | null {
  if (!error) return null;
  if (error.code === 'PGRST202' || /could not find the function|admin_get_beta_feedback/i.test(error.message ?? '')) return 'The feedback inbox needs migration 20260929000001_feedback_v2.sql (not applied on this project yet).';
  if (/NOT_AUTHORIZED|permission denied/i.test(error.message ?? '')) return 'This account has no feedback-reading role.';
  return (error.message ?? 'Could not load reports.').split('\n')[0].slice(0, 160);
}
