import * as fs from 'fs';
import * as path from 'path';

import { ADMIN_SECTIONS, rowToFormValues } from '../sections';
import {
  currentRevision,
  describeChangedFields,
  diffFields,
  editorLabel,
  fieldsFromValues,
  isConflict,
  parseRevisionRows,
  publishProblem,
  REVISION_SECTIONS,
  revisionErrorMessage,
  valuesFromFields,
} from './revisionModel';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));

const root = path.join(__dirname, '../../../..');
const sql = fs.readFileSync(path.join(root, 'supabase/migrations/20261004000002_content_revisions.sql'), 'utf8');
const fn = (name: string) => {
  const start = sql.indexOf(`create or replace function public.${name}(`);
  expect(start).toBeGreaterThan(-1);
  return sql.slice(start, sql.indexOf('$$;', sql.indexOf('as $$', start)) + 3);
};
const items = ADMIN_SECTIONS.find((section) => section.id === 'culture_items')!;
const label = (field: string) => items.fields.find((candidate) => candidate.key === field)?.label ?? field;
const ROW = { id: 'boz-uy-tunduk', category_id: 'boz-uy', title: 'Түндүк', history: 'old', accuracy_level: 'partially_verified', sources: ['https://ky.wikipedia.org/wiki/x'], sort_order: 1 };

describe('revision model (client)', () => {
  it('only Culture items/materials publish through revisions', () => {
    expect(REVISION_SECTIONS).toEqual({ culture_items: 'culture_item', culture_materials: 'culture_material' });
  });

  it('authored fields never carry an id or an editor identity, and round-trip into the form', () => {
    const values = rowToFormValues(items, ROW);
    const fields = fieldsFromValues(items, values);
    expect(fields).not.toHaveProperty('id');
    expect(Object.keys(fields).some((key) => /changed_by|user|editor|auth/.test(key))).toBe(false);
    expect(fields.sources).toEqual(['https://ky.wikipedia.org/wiki/x']);
    expect(valuesFromFields(items, fields, 'boz-uy-tunduk')).toEqual(values);
  });

  it('field-level diff: title/history changed, source added/removed, verification changed', () => {
    const before = fieldsFromValues(items, rowToFormValues(items, ROW));
    const after = { ...before, title: 'Tunduk', history: 'new', sources: ['https://example.org/a'], accuracy_level: 'verified' };
    expect(diffFields(before, after, label)).toEqual(expect.arrayContaining(['Title changed', 'History changed', 'Source added', 'Source removed', 'Verification changed: partially_verified → verified']));
    expect(diffFields(before, { ...before }, label)).toEqual([]);
    expect(diffFields(null, after, label)).toEqual(['New content']);
    expect(describeChangedFields(['history', 'sources', 'accuracy_level', 'translations'], label)).toBe('History, Sources, Verification, Translations');
  });

  it('publish validation mirrors the server: title, source URLs, verified needs sources', () => {
    expect(publishProblem({ title: ' ' })).toMatch(/title/i);
    expect(publishProblem({ title: 'x', sources: ['not a url'] })).toMatch(/source/i);
    expect(publishProblem({ title: 'x', accuracy_level: 'verified', sources: [] })).toMatch(/Verified/);
    expect(publishProblem({ title: 'x', accuracy_level: 'verified', sources: ['https://ky.wikipedia.org/wiki/x'] })).toBeNull();
  });

  it('history: newest first, admin-safe editor label, current revision', () => {
    const rows = parseRevisionRows([
      { revision_number: 1, action: 'baseline', changed_fields: [], created_at: '2026-10-01', editor_role: 'content_editor', is_mine: false },
      { revision_number: 3, action: 'restored', restored_from: 1, changed_fields: ['history'], created_at: '2026-10-03', editor_role: 'super_admin', is_mine: true },
      { revision_number: 2, action: 'published', changed_fields: ['title'], created_at: '2026-10-02', editor_role: null, is_mine: false, email: 'admin@x.kg' },
    ]);
    expect(rows.map((row) => row.revisionNumber)).toEqual([3, 2, 1]);
    expect(currentRevision(rows)).toBe(3);
    expect(rows.map(editorLabel)).toEqual(['You', 'Former editor', 'Content editor']);
    expect(JSON.stringify(rows)).not.toContain('admin@x.kg');
  });

  it('conflicts, failures and a missing backend never read as "published"', () => {
    expect(revisionErrorMessage({ message: 'REVISION_CONFLICT' })).toBe('Content changed since you opened it. Refresh before publishing.');
    expect(isConflict({ message: 'REVISION_CONFLICT' })).toBe(true);
    expect(revisionErrorMessage({ message: 'NOT_AUTHORIZED' })).toMatch(/isn't allowed/);
    expect(revisionErrorMessage({ message: 'VALIDATION:verified_needs_sources' })).toMatch(/Verified/);
    expect(revisionErrorMessage({ code: 'PGRST202', message: 'Could not find the function' })).toMatch(/not applied.*Nothing was published/);
    expect(revisionErrorMessage({ message: 'connection reset' })).toBe('Publishing failed. Your edits are still here; nothing was published.');
    for (const message of ['REVISION_CONFLICT', 'NOT_AUTHORIZED', 'boom']) expect(revisionErrorMessage({ message })).not.toMatch(/^Published/);
  });

  it('the editor keeps its content on failure (no reset in the error path)', () => {
    const ui = fs.readFileSync(path.join(__dirname, 'RevisionWorkflow.tsx'), 'utf8');
    const onError = ui.slice(ui.indexOf('const publishMutation'), ui.indexOf('const viewed'));
    expect(onError).toMatch(/onError: \(error: Error\) => \{\s*setConflict\(isConflict\(error\)\);\s*setMessage\(\{ tone: 'error'/);
    expect(onError.slice(onError.indexOf('onError'))).not.toMatch(/onReplaceValues|onPublished/);
  });
});

describe('content_revisions migration (server rules, committed - not applied)', () => {
  it('immutable revisions with unique numbers; drafts in a separate admin-only table', () => {
    expect(sql).toMatch(/unique \(content_type, content_id, revision_number\)/);
    expect(sql).toMatch(/before update or delete on public\.content_revisions/);
    expect(fn('content_revisions_immutable')).toContain("raise exception 'REVISIONS_ARE_IMMUTABLE'");
    expect(sql).toMatch(/create table if not exists public\.content_drafts/);
  });

  it('RLS: only admin/editor roles can read; normal users have no access; no client writes', () => {
    expect(sql).toMatch(/alter table public\.content_revisions enable row level security/);
    expect(sql).toMatch(/alter table public\.content_drafts enable row level security/);
    expect(sql).toMatch(/revoke insert, update, delete on public\.content_revisions from anon, authenticated/);
    expect(sql.match(/role in \('super_admin', 'content_editor'\)/g)).toHaveLength(2);
    for (const name of ['admin_save_content_draft', 'admin_get_content_draft', 'admin_publish_content', 'admin_restore_revision', 'admin_list_content_revisions', 'admin_get_content_revision'])
      expect(fn(name)).toContain("perform public.require_admin_role(array['super_admin', 'content_editor'])");
    for (const name of ['content_authored_snapshot', 'content_fields_problem', 'content_apply_fields']) expect(sql).toContain(`revoke all on function public.${name}(`);
  });

  it('changed_by comes from auth.uid(), never from a client parameter', () => {
    expect(sql).not.toMatch(/p_changed_by|p_editor|p_user_id/);
    const publish = fn('admin_publish_content');
    expect(publish).toMatch(/'published', v_after, v_changed, auth\.uid\(\)/);
  });

  it('publish: conflict check under a lock, validation, live row + revision in one function, draft cleared, audited', () => {
    const publish = fn('admin_publish_content');
    const order = ['pg_advisory_xact_lock', "raise exception 'REVISION_CONFLICT'", 'content_fields_problem', 'content_apply_fields', "v_current + 1, 'published'", 'delete from public.content_drafts', "values (auth.uid(), 'published'"].map((needle) => publish.indexOf(needle));
    expect(order.every((index) => index > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(publish).toContain("raise exception 'NO_CHANGES'");
    expect(publish).toContain("'baseline'");
  });

  it('draft save never touches the live content (so What\'s New is not affected)', () => {
    const draft = fn('admin_save_content_draft');
    expect(draft).not.toMatch(/culture_items|culture_materials|content_apply_fields/);
    expect(draft).toContain("'draft_saved'");
    expect(sql).not.toMatch(/content_updated_at\s*:?=/);
  });

  it('rollback creates a NEW revision, restores sources + verification + translations, never deletes history', () => {
    const restore = fn('admin_restore_revision');
    expect(restore).toMatch(/v_current \+ 1, 'restored', p_revision_number/);
    expect(restore).toContain("content_apply_fields(p_content_type, p_content_id, v_target->'fields')");
    expect(restore).toContain('insert into public.content_translations');
    expect(restore).toContain("'revision_restored'");
    expect(restore).not.toMatch(/delete from public\.content_revisions|update public\.content_revisions/);
    const snapshot = fn('content_authored_snapshot');
    expect(snapshot).toContain("'accuracy_level', accuracy_level, 'sources'");
    expect(snapshot).not.toMatch(/token|email|analytics|feedback|image_url/);
  });

  it('server validation blocks bad publishes', () => {
    const rules = fn('content_fields_problem');
    for (const code of ['title_required', 'invalid_source_url', 'verified_needs_sources', 'unknown_category', 'invalid_kind', 'unsupported_field:']) expect(rules).toContain(code);
  });
});
