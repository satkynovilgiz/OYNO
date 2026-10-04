import { CULTURE_ITEM_BODY_FIELDS } from '@/services/content/localizedContent';

import { isValidSourceUrl, validateTranslation, type AdminTranslationRow } from '../adminModel';
import type { AdminSectionConfig } from '../sections';

/**
 * Admin Revision History + Safe Publishing - pure client rules. The server
 * (20261004000002_content_revisions.sql) is the authority: it re-validates,
 * checks the revision number, writes the revision and the live row in one
 * transaction and takes the editor's identity from auth.uid().
 */

export type RevisionContentType = 'culture_item' | 'culture_material';

/** Admin sections that publish through revisions (others keep direct save). */
export const REVISION_SECTIONS: Record<string, RevisionContentType> = {
  culture_items: 'culture_item',
  culture_materials: 'culture_material',
};

export type AuthoredFields = Record<string, unknown>;
export type TranslationLanguage = 'ru' | 'en';
export type TranslationStatus = 'draft' | 'reviewed';
/** One RU/EN field of a revision / draft / publish payload. */
export type TranslationDraft = { language: TranslationLanguage; field: string; value: string; status: TranslationStatus };
export type RevisionSnapshot = { fields: AuthoredFields; translations: TranslationDraft[] };
/**
 * Unpublished RU/EN edits in the editor, keyed `language|field`. Only
 * touched fields are present; `removed` drops a live translation on
 * publish. Nothing here is public until admin_publish_content.
 */
export type TranslationEdit = { value: string; status: TranslationStatus; removed?: boolean };
export type TranslationEdits = Record<string, TranslationEdit>;

export type RevisionRow = {
  revisionNumber: number;
  action: 'baseline' | 'published' | 'restored';
  restoredFrom: number | null;
  changedFields: string[];
  createdAt: string;
  editorRole: string | null;
  isMine: boolean;
};

/** The editor's form values as the authored fields the server stores (no id, no client identity). */
export function fieldsFromValues(section: AdminSectionConfig, values: Record<string, string>): AuthoredFields {
  const params = section.toParams(values);
  const fields: AuthoredFields = {};
  for (const [key, value] of Object.entries(params)) {
    if (key === 'p_id') continue;
    fields[key.replace(/^p_/, '')] = value;
  }
  return fields;
}

/** A stored snapshot's fields back into editor form values. */
export function valuesFromFields(section: AdminSectionConfig, fields: AuthoredFields, id: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of section.fields) {
    const raw = field.key === section.idField ? id : fields[field.key];
    values[field.key] = raw == null ? '' : Array.isArray(raw) ? raw.join('\n') : String(raw);
  }
  return values;
}

export function parseRevisionRows(raw: unknown): RevisionRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
    .map((row) => ({
      revisionNumber: Number(row.revision_number) || 0,
      action: (['baseline', 'published', 'restored'].includes(String(row.action)) ? row.action : 'published') as RevisionRow['action'],
      restoredFrom: typeof row.restored_from === 'number' ? row.restored_from : null,
      changedFields: Array.isArray(row.changed_fields) ? row.changed_fields.filter((field): field is string => typeof field === 'string') : [],
      createdAt: String(row.created_at ?? ''),
      editorRole: typeof row.editor_role === 'string' ? row.editor_role : null,
      isMine: row.is_mine === true,
    }))
    .filter((row) => row.revisionNumber > 0)
    .sort((a, b) => b.revisionNumber - a.revisionNumber);
}

export function currentRevision(rows: readonly RevisionRow[]): number {
  return rows.reduce((max, row) => Math.max(max, row.revisionNumber), 0);
}

/** "You", or the editor's role - never an email or account id. */
export function editorLabel(row: Pick<RevisionRow, 'isMine' | 'editorRole'>): string {
  if (row.isMine) return 'You';
  if (row.editorRole === 'super_admin') return 'Super admin';
  if (row.editorRole === 'content_editor') return 'Content editor';
  return 'Former editor';
}

const asList = (value: unknown): string[] => (Array.isArray(value) ? value.map(String) : []);

/** Field-level change summary between the live state and the edited one. */
export function diffFields(before: AuthoredFields | null, after: AuthoredFields, label: (field: string) => string): string[] {
  if (!before) return ['New content'];
  const changes: string[] = [];
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (!(key in after)) continue;
    if (key === 'sources') {
      const was = asList(before.sources);
      const now = asList(after.sources);
      const added = now.filter((url) => !was.includes(url)).length;
      const removed = was.filter((url) => !now.includes(url)).length;
      if (added) changes.push(added === 1 ? 'Source added' : `${added} sources added`);
      if (removed) changes.push(removed === 1 ? 'Source removed' : `${removed} sources removed`);
      if (!added && !removed && was.join('\n') !== now.join('\n')) changes.push('Sources reordered');
      continue;
    }
    const a = before[key] ?? null;
    const b = after[key] ?? null;
    const same = (a === '' ? null : a) === (b === '' ? null : b) || JSON.stringify(a) === JSON.stringify(b);
    if (same) continue;
    if (key === 'accuracy_level') changes.push(`Verification changed: ${String(a ?? 'unverified')} → ${String(b ?? 'unverified')}`);
    else changes.push(`${label(key)} changed`);
  }
  return changes;
}

/** Server changed_fields names -> readable list for the history. */
export function describeChangedFields(fields: readonly string[], label: (field: string) => string): string {
  if (fields.length === 0) return 'No field changes';
  return fields.map((field) => (field === 'accuracy_level' ? 'Verification' : field === 'sources' ? 'Sources' : field === 'translations' ? 'Translations' : label(field))).join(', ');
}

/** Same rules the server enforces, shown before the round trip. */
export function publishProblem(fields: AuthoredFields): string | null {
  if (typeof fields.title !== 'string' || !fields.title.trim()) return 'A title is required before publishing.';
  const sources = asList(fields.sources);
  const bad = sources.find((url) => !isValidSourceUrl(url));
  if (bad) return `Not a valid source link: ${bad.slice(0, 80)}`;
  if (fields.accuracy_level === 'verified' && sources.length === 0) return '"Verified" needs at least one source.';
  return null;
}

// ---------------------------------------------------------------------
// RU / EN translations inside the revision workflow
// ---------------------------------------------------------------------

/** Mirrors content_translatable_fields() in 20261004000003_revision_translations.sql. */
export const REVISION_TRANSLATABLE_FIELDS: Record<RevisionContentType, readonly string[]> = {
  culture_item: ['title', 'alt_names', ...CULTURE_ITEM_BODY_FIELDS],
  culture_material: ['title', 'description', 'body'],
};
export const MAX_TRANSLATION_LENGTH = 20000;

export const translationKey = (language: string, field: string) => `${language}|${field}`;
const byKey = (a: TranslationDraft, b: TranslationDraft) => translationKey(a.language, a.field).localeCompare(translationKey(b.language, b.field));

/** Coerce any server/snapshot list into well-formed drafts (unknown shapes dropped). */
export function parseTranslations(raw: unknown): TranslationDraft[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object')
    .filter((entry) => (entry.language === 'ru' || entry.language === 'en') && typeof entry.field === 'string' && typeof entry.value === 'string')
    .map((entry): TranslationDraft => ({ language: entry.language as TranslationLanguage, field: entry.field as string, value: entry.value as string, status: entry.status === 'reviewed' ? 'reviewed' : 'draft' }))
    .sort(byKey);
}

/** The live RU/EN set of one content row, from the admin translation list. */
export function liveTranslationsFor(type: RevisionContentType, id: string, rows: readonly AdminTranslationRow[]): TranslationDraft[] {
  return parseTranslations(rows.filter((row) => row.content_type === type && row.content_id === id));
}

/** Live set + editor edits = the complete set a draft / publish carries. */
export function mergeTranslations(live: readonly TranslationDraft[], edits: TranslationEdits): TranslationDraft[] {
  const merged = new Map(live.map((entry) => [translationKey(entry.language, entry.field), { ...entry }]));
  for (const [key, edit] of Object.entries(edits)) {
    const [language, field] = key.split('|');
    if (edit.removed) merged.delete(key);
    else merged.set(key, { language: language as TranslationLanguage, field, value: edit.value, status: edit.status });
  }
  return [...merged.values()].sort(byKey);
}

/** Edits that differ from the live set (what makes the editor dirty). */
export function changedTranslationKeys(live: readonly TranslationDraft[], edits: TranslationEdits): string[] {
  const liveMap = new Map(live.map((entry) => [translationKey(entry.language, entry.field), entry]));
  return Object.entries(edits)
    .filter(([key, edit]) => {
      const was = liveMap.get(key);
      if (edit.removed) return !!was;
      return !was ? edit.value !== '' || edit.status !== 'draft' : was.value !== edit.value || was.status !== edit.status;
    })
    .map(([key]) => key)
    .sort();
}

/** Turn a saved draft's full set back into edits on top of the current live set. */
export function editsFromTranslations(live: readonly TranslationDraft[], target: readonly TranslationDraft[]): TranslationEdits {
  const edits: TranslationEdits = {};
  for (const entry of target) edits[translationKey(entry.language, entry.field)] = { value: entry.value, status: entry.status };
  for (const entry of live) {
    const key = translationKey(entry.language, entry.field);
    if (!edits[key]) edits[key] = { value: entry.value, status: entry.status, removed: true };
  }
  for (const key of Object.keys(edits)) if (!changedTranslationKeys(live, { [key]: edits[key] }).length) delete edits[key];
  return edits;
}

/** Human summary of RU/EN changes for the preview ("EN · Title changed"). */
export function diffTranslations(live: readonly TranslationDraft[], next: readonly TranslationDraft[], label: (field: string) => string): string[] {
  const was = new Map(live.map((entry) => [translationKey(entry.language, entry.field), entry]));
  const now = new Map(next.map((entry) => [translationKey(entry.language, entry.field), entry]));
  const changes: string[] = [];
  for (const key of [...new Set([...was.keys(), ...now.keys()])].sort()) {
    const [language, field] = key.split('|');
    const tag = `${language.toUpperCase()} · ${label(field)}`;
    const a = was.get(key);
    const b = now.get(key);
    if (!a && b) changes.push(`${tag} added${b.status === 'reviewed' ? ' (reviewed)' : ' (draft)'}`);
    else if (a && !b) changes.push(`${tag} removed`);
    else if (a && b) {
      if (a.value !== b.value) changes.push(`${tag} changed`);
      if (a.status !== b.status) changes.push(`${tag} marked ${b.status}`);
    }
  }
  return changes;
}

/**
 * Same rules as content_translations_problem() on the server: supported
 * languages and fields only, no duplicates, bounded length; for publish,
 * every value must be non-empty (validateTranslation).
 */
export function translationsProblem(type: RevisionContentType, translations: readonly TranslationDraft[], label: (field: string) => string, forPublish: boolean): string | null {
  const allowed = REVISION_TRANSLATABLE_FIELDS[type];
  const seen = new Set<string>();
  for (const entry of translations) {
    const tag = `${String(entry.language).toUpperCase()} · ${label(entry.field)}`;
    if (entry.language !== 'ru' && entry.language !== 'en') return `Unsupported translation language: ${String(entry.language)}`;
    if (!allowed.includes(entry.field)) return `${tag}: this field can't be translated.`;
    if (entry.value.length > MAX_TRANSLATION_LENGTH) return `${tag}: translation is too long.`;
    const key = translationKey(entry.language, entry.field);
    if (seen.has(key)) return `${tag}: duplicate translation.`;
    seen.add(key);
    if (forPublish) {
      const problem = validateTranslation(entry.value, entry.status);
      if (problem) return `${tag}: ${problem}`;
    } else if (entry.status !== 'draft' && entry.status !== 'reviewed') return `${tag}: Unknown status.`;
  }
  return null;
}

/** Admin translation rows with this content's rows replaced by the edited set - for previews. */
export function withDraftTranslations(type: RevisionContentType, id: string, rows: readonly AdminTranslationRow[], translations: readonly TranslationDraft[]): AdminTranslationRow[] {
  return [
    ...rows.filter((row) => !(row.content_type === type && row.content_id === id)),
    ...translations.map((entry) => ({ id: `${type}|${id}|${entry.language}|${entry.field}`, content_type: type, content_id: id, ...entry })),
  ];
}

/** What a publish would change: canonical fields, translations, or both. */
export function publishScope(fieldChanges: readonly string[], translationChanges: readonly string[]): 'none' | 'content' | 'translations' | 'both' {
  if (fieldChanges.length && translationChanges.length) return 'both';
  if (fieldChanges.length) return 'content';
  if (translationChanges.length) return 'translations';
  return 'none';
}

/** Server errors -> admin-facing message. The editor content always stays on screen. */
export function revisionErrorMessage(error: { message?: string; code?: string } | null | undefined): string {
  const message = error?.message ?? '';
  if (error?.code === 'PGRST202' || error?.code === '42883' || /could not find the function/i.test(message)) return "Revision history isn't available yet - migrations 20261004000002_content_revisions.sql / 20261004000003_revision_translations.sql are not applied on this project. Nothing was published.";
  if (/REVISION_CONFLICT/.test(message)) return 'Content changed since you opened it. Refresh before publishing.';
  if (/NOT_AUTHORIZED|permission denied/i.test(message)) return "This account isn't allowed to publish content.";
  if (/NO_CHANGES/.test(message)) return 'Nothing to publish - this matches the live version.';
  if (/ALREADY_CURRENT/.test(message)) return 'This is already the live version.';
  if (/USE_REVISION_PUBLISH/.test(message)) return 'Culture translations are published with the content - use Save draft / Preview & publish.';
  const validation = /VALIDATION:([a-z_:.-]+)/.exec(message);
  if (validation) {
    const code = validation[1];
    const known: Record<string, string> = {
      title_required: 'A title is required before publishing.',
      invalid_source_url: 'One of the sources is not a valid link.',
      verified_needs_sources: '"Verified" needs at least one source.',
      unknown_category: 'The category does not exist.',
      invalid_kind: 'Choose a valid material kind.',
      invalid_verification: 'Choose a valid verification level.',
      translation_language: 'Only RU and EN translations are supported.',
      translation_status: 'A translation has an unknown status.',
      translation_too_long: 'A translation is too long.',
      translation_duplicate: 'A translation field appears twice.',
      too_many_translations: 'Too many translations in one publish.',
    };
    if (code.startsWith('translation_empty:')) return `Translation ${code.slice('translation_empty:'.length).toUpperCase()} is empty - write it or remove it.`;
    if (code.startsWith('translation_field:')) return `"${code.slice('translation_field:'.length)}" can't be translated.`;
    return known[code] ?? `Publishing blocked: ${code}`;
  }
  return 'Publishing failed. Your edits are still here; nothing was published.';
}

export function isConflict(error: { message?: string } | null | undefined): boolean {
  return /REVISION_CONFLICT/.test(error?.message ?? '');
}
