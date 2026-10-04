import { isValidSourceUrl } from '../adminModel';
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
export type RevisionSnapshot = { fields: AuthoredFields; translations: { language: string; field: string; value: string; status: string }[] };

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

/** Server errors -> admin-facing message. The editor content always stays on screen. */
export function revisionErrorMessage(error: { message?: string; code?: string } | null | undefined): string {
  const message = error?.message ?? '';
  if (error?.code === 'PGRST202' || error?.code === '42883' || /could not find the function/i.test(message)) return "Revision history isn't available yet - migration 20261004000002_content_revisions.sql is not applied on this project. Nothing was published.";
  if (/REVISION_CONFLICT/.test(message)) return 'Content changed since you opened it. Refresh before publishing.';
  if (/NOT_AUTHORIZED|permission denied/i.test(message)) return "This account isn't allowed to publish content.";
  if (/NO_CHANGES/.test(message)) return 'Nothing to publish - this matches the live version.';
  if (/ALREADY_CURRENT/.test(message)) return 'This is already the live version.';
  const validation = /VALIDATION:([a-z_:-]+)/.exec(message);
  if (validation) {
    const code = validation[1];
    const known: Record<string, string> = {
      title_required: 'A title is required before publishing.',
      invalid_source_url: 'One of the sources is not a valid link.',
      verified_needs_sources: '"Verified" needs at least one source.',
      unknown_category: 'The category does not exist.',
      invalid_kind: 'Choose a valid material kind.',
      invalid_verification: 'Choose a valid verification level.',
    };
    return known[code] ?? `Publishing blocked: ${code}`;
  }
  return 'Publishing failed. Your edits are still here; nothing was published.';
}

export function isConflict(error: { message?: string } | null | undefined): boolean {
  return /REVISION_CONFLICT/.test(error?.message ?? '');
}
