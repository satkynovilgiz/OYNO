import * as fs from 'fs';
import * as path from 'path';

import { previewFor, type AdminTranslationRow } from '../adminModel';
import { ADMIN_SECTIONS } from '../sections';
import {
  changedTranslationKeys,
  diffTranslations,
  editsFromTranslations,
  liveTranslationsFor,
  mergeTranslations,
  parseTranslations,
  publishScope,
  REVISION_TRANSLATABLE_FIELDS,
  revisionErrorMessage,
  translationsProblem,
  withDraftTranslations,
  type TranslationDraft,
} from './revisionModel';
import { getDraft, publishContent, saveDraft } from './revisionService';

const mockRpc = jest.fn();
jest.mock('@/services/supabase/client', () => ({ supabase: { rpc: (...args: unknown[]) => mockRpc(...args) } }));

const root = path.join(__dirname, '../../../..');
const sql = fs.readFileSync(path.join(root, 'supabase/migrations/20261004000003_revision_translations.sql'), 'utf8');
const fn = (name: string) => {
  const start = sql.indexOf(`create or replace function public.${name}(`);
  expect(start).toBeGreaterThan(-1);
  return sql.slice(start, sql.indexOf('$$;', sql.indexOf('as $$', start)) + 3);
};
const read = (file: string) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const label = (field: string) => ({ title: 'Title', history: 'History', body: 'Body' })[field] ?? field;

const ROWS: AdminTranslationRow[] = [
  { id: 'a', content_type: 'culture_item', content_id: 'tunduk', language: 'en', field: 'title', value: 'Tunduk', status: 'reviewed' },
  { id: 'b', content_type: 'culture_item', content_id: 'tunduk', language: 'ru', field: 'title', value: 'Тундук', status: 'reviewed' },
  { id: 'c', content_type: 'culture_item', content_id: 'other', language: 'en', field: 'title', value: 'Other', status: 'reviewed' },
];
const LIVE = liveTranslationsFor('culture_item', 'tunduk', ROWS);

beforeEach(() => mockRpc.mockReset());

describe('translation drafts (client model)', () => {
  it('live set is scoped to one content and shaped {language, field, value, status}', () => {
    expect(LIVE).toEqual([
      { language: 'en', field: 'title', value: 'Tunduk', status: 'reviewed' },
      { language: 'ru', field: 'title', value: 'Тундук', status: 'reviewed' },
    ]);
  });

  it('edits merge into a complete set; removal drops a live translation', () => {
    const merged = mergeTranslations(LIVE, { 'en|title': { value: 'Tündük', status: 'reviewed' }, 'ru|title': { value: 'Тундук', status: 'reviewed', removed: true }, 'en|history': { value: 'Smoke hole', status: 'draft' } });
    expect(merged).toEqual([
      { language: 'en', field: 'history', value: 'Smoke hole', status: 'draft' },
      { language: 'en', field: 'title', value: 'Tündük', status: 'reviewed' },
    ]);
  });

  it('dirty state: only edits that differ from live count (translation-only dirty is detected)', () => {
    expect(changedTranslationKeys(LIVE, {})).toEqual([]);
    expect(changedTranslationKeys(LIVE, { 'en|title': { value: 'Tunduk', status: 'reviewed' } })).toEqual([]);
    expect(changedTranslationKeys(LIVE, { 'en|title': { value: 'Tündük', status: 'reviewed' } })).toEqual(['en|title']);
    expect(changedTranslationKeys(LIVE, { 'en|title': { value: 'Tunduk', status: 'draft' } })).toEqual(['en|title']);
    expect(changedTranslationKeys(LIVE, { 'ru|title': { value: 'x', status: 'reviewed', removed: true } })).toEqual(['ru|title']);
    expect(changedTranslationKeys(LIVE, { 'en|history': { value: '', status: 'draft' } })).toEqual([]);
  });

  it('publish button scope: canonical-only, translation-only, both', () => {
    expect(publishScope([], [])).toBe('none');
    expect(publishScope(['Title changed'], [])).toBe('content');
    expect(publishScope([], ['EN · Title changed'])).toBe('translations');
    expect(publishScope(['Title changed'], ['EN · Title changed'])).toBe('both');
  });

  it('translation diff for the preview', () => {
    const next = mergeTranslations(LIVE, { 'en|title': { value: 'Tündük', status: 'draft' }, 'ru|title': { value: '', status: 'reviewed', removed: true }, 'en|history': { value: 'h', status: 'reviewed' } });
    expect(diffTranslations(LIVE, next, label)).toEqual(['EN · History added (reviewed)', 'EN · Title changed', 'EN · Title marked draft', 'RU · Title removed']);
  });

  it('a saved draft set loads back as edits that reproduce it exactly', () => {
    const target: TranslationDraft[] = [{ language: 'en', field: 'title', value: 'Tündük', status: 'reviewed' }];
    const edits = editsFromTranslations(LIVE, target);
    expect(mergeTranslations(LIVE, edits)).toEqual(target);
    expect(editsFromTranslations(LIVE, LIVE)).toEqual({});
  });

  it('validation reuses translation rules: languages, fields, empties, duplicates, length', () => {
    const ok: TranslationDraft = { language: 'en', field: 'title', value: 'T', status: 'reviewed' };
    expect(translationsProblem('culture_item', [ok], label, true)).toBeNull();
    expect(translationsProblem('culture_item', [{ ...ok, language: 'de' as 'en' }], label, true)).toMatch(/language/);
    expect(translationsProblem('culture_material', [{ ...ok, field: 'history' }], label, true)).toMatch(/can't be translated/);
    expect(translationsProblem('culture_item', [{ ...ok, value: '  ' }], label, true)).toMatch(/empty/);
    expect(translationsProblem('culture_item', [{ ...ok, value: '  ' }], label, false)).toBeNull();
    expect(translationsProblem('culture_item', [ok, ok], label, true)).toMatch(/duplicate/);
    expect(translationsProblem('culture_item', [{ ...ok, value: 'x'.repeat(20001) }], label, false)).toMatch(/too long/);
  });

  it('client field list mirrors the server allow-list', () => {
    for (const [type, fields] of Object.entries(REVISION_TRANSLATABLE_FIELDS)) {
      const body = fn('content_translatable_fields');
      const line = body.slice(body.indexOf(`when '${type}'`));
      for (const field of fields) expect(line.slice(0, line.indexOf(']'))).toContain(`'${field}'`);
    }
  });

  it('preview renders edited RU/EN from draft state, not the live translations', () => {
    const items = ADMIN_SECTIONS.find((section) => section.id === 'culture_items')!;
    expect(items).toBeTruthy();
    const draft = mergeTranslations(LIVE, { 'en|title': { value: 'Tündük (edited)', status: 'reviewed' } });
    const rows = withDraftTranslations('culture_item', 'tunduk', ROWS, draft);
    const row = { id: 'tunduk', category_id: 'boz-uy', title: 'Түндүк (KG edit)', history: 'Тарых' };
    expect(previewFor('culture_item', row, 'en', rows).title).toBe('Tündük (edited)');
    expect(previewFor('culture_item', row, 'ru', rows).title).toBe('Тундук');
    expect(previewFor('culture_item', row, 'kg', rows).title).toBe('Түндүк (KG edit)');
    // Other content's live rows are untouched.
    expect(rows.find((entry) => entry.content_id === 'other')?.value).toBe('Other');
    // A draft-status edit is previewed honestly: readers would NOT see it.
    const unreviewed = withDraftTranslations('culture_item', 'tunduk', ROWS, mergeTranslations(LIVE, { 'en|title': { value: 'WIP', status: 'draft' } }));
    expect(previewFor('culture_item', row, 'en', unreviewed).title).not.toBe('WIP');
  });

  it('server messages for translation problems and blocked direct writes', () => {
    expect(revisionErrorMessage({ message: 'VALIDATION:translation_empty:en.title' })).toBe('Translation EN.TITLE is empty - write it or remove it.');
    expect(revisionErrorMessage({ message: 'VALIDATION:translation_field:history' })).toMatch(/can't be translated/);
    expect(revisionErrorMessage({ message: 'USE_REVISION_PUBLISH' })).toMatch(/Preview & publish/);
    expect(parseTranslations([{ language: 'xx', field: 'title', value: 'v' }, { language: 'en', field: 'title', value: 'v', status: 'weird' }])).toEqual([{ language: 'en', field: 'title', value: 'v', status: 'draft' }]);
  });
});

describe('revision service sends fields + translations together', () => {
  const set: TranslationDraft[] = [{ language: 'en', field: 'title', value: 'Tündük', status: 'reviewed' }];

  it('Save Draft: one RPC with canonical fields and the translation set; no live translation RPC', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await saveDraft('culture_item', 'tunduk', { title: 'Түндүк' }, set, 4);
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('admin_save_content_draft', { p_content_type: 'culture_item', p_content_id: 'tunduk', p_fields: { title: 'Түндүк' }, p_base_revision: 4, p_translations: set });
  });

  it('Publish: one RPC carrying fields, translations and the expected revision', async () => {
    mockRpc.mockResolvedValue({ data: 5, error: null });
    await expect(publishContent('culture_item', 'tunduk', { title: 'Түндүк' }, set, 4)).resolves.toBe(5);
    expect(mockRpc).toHaveBeenCalledWith('admin_publish_content', { p_content_type: 'culture_item', p_content_id: 'tunduk', p_fields: { title: 'Түндүк' }, p_expected_revision: 4, p_translations: set });
    expect(JSON.stringify(mockRpc.mock.calls)).not.toMatch(/changed_by|user_id|admin_upsert_content_translation/);
  });

  it('conflict on a translation edit surfaces as REVISION_CONFLICT (nothing published)', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'REVISION_CONFLICT' } });
    await expect(publishContent('culture_item', 'tunduk', {}, set, 4)).rejects.toEqual({ message: 'REVISION_CONFLICT' });
    expect(revisionErrorMessage({ message: 'REVISION_CONFLICT' })).toMatch(/Refresh before publishing/);
  });

  it('draft loads its translation set (null for older drafts without one)', async () => {
    mockRpc.mockResolvedValueOnce({ data: [{ fields: { title: 'x' }, translations: set, base_revision: 4, updated_at: 't', is_mine: true }], error: null });
    expect((await getDraft('culture_item', 'tunduk'))?.translations).toEqual(set);
    mockRpc.mockResolvedValueOnce({ data: [{ fields: { title: 'x' }, translations: null, base_revision: 4, updated_at: 't', is_mine: true }], error: null });
    expect((await getDraft('culture_item', 'tunduk'))?.translations).toBeNull();
  });
});

describe('editor wiring', () => {
  const panel = read('../components/TranslationsPanel.tsx');
  const workflow = read('RevisionWorkflow.tsx');
  const screen = read('../AdminSectionScreen.tsx');

  it('revision editors use revision_draft mode; direct mode stays for other content', () => {
    expect(screen).toMatch(/mode=\{revisionType \? \{ kind: 'revision_draft'.*\} : \{ kind: 'direct'/);
    // The only live write in the panel is behind the direct mode guard.
    const saveOne = panel.slice(panel.indexOf('function saveOne'), panel.indexOf('function stateText'));
    expect(saveOne).toMatch(/if \(revision\) return;/);
    expect(workflow).not.toContain('admin_upsert_content_translation');
  });

  it('unsaved translation drafts make the editor dirty (navigation warning)', () => {
    expect(screen).toMatch(/const dirty = !!editingRow && \(.*revisionTranslationDirty > 0/);
    expect(screen).toContain("navigation.addListener('beforeRemove'");
  });

  it('publish failure keeps translation edits; success/restore/refresh clear them', () => {
    const publish = workflow.slice(workflow.indexOf('const publishMutation'), workflow.indexOf('const viewed'));
    const onError = publish.slice(publish.indexOf('onError'));
    expect(onError).not.toMatch(/onTranslationEditsChange|onReplaceValues|onPublished/);
    expect(publish.slice(0, publish.indexOf('onError'))).toContain('onTranslationEditsChange({})');
    expect(workflow.slice(workflow.indexOf('const restoreMutation'), workflow.indexOf('const refreshLatest'))).toContain('onTranslationEditsChange({})');
  });

  it('both previews read draft translations', () => {
    expect(workflow).toMatch(/<ContentPreviewPanel [^>]*translations=\{previewTranslations\}/);
    expect(screen).toMatch(/<ContentPreviewPanel [^>]*translations=\{previewTranslations\}/);
  });

  it('the generic Translations section no longer offers Culture content types', () => {
    const section = ADMIN_SECTIONS.find((candidate) => candidate.id === 'content_translations')!;
    expect(section.fields.find((field) => field.key === 'content_type')?.options).toEqual(['explore_region', 'quest']);
  });
});

describe('20261004000003_revision_translations.sql (server rules, committed - not applied)', () => {
  it('drafts store translations next to fields; draft save never touches live content or translations', () => {
    expect(sql).toMatch(/alter table public\.content_drafts add column if not exists translations jsonb/);
    const save = fn('admin_save_content_draft');
    expect(save).toContain("content_translations_problem(p_content_type, p_translations, false)");
    expect(save).not.toMatch(/culture_items|culture_materials|content_apply_fields|content_replace_translations|insert into public\.content_translations|content_updated_at/);
    expect(fn('admin_get_content_draft')).toContain('d.translations');
  });

  it('publish is one function: conflict -> validate fields + translations -> live row -> translations -> revision -> clear draft -> audit', () => {
    const publish = fn('admin_publish_content');
    const order = [
      "perform public.require_admin_role(array['super_admin', 'content_editor'])",
      'pg_advisory_xact_lock',
      "raise exception 'REVISION_CONFLICT'",
      'content_fields_problem(p_content_type, p_fields)',
      'content_translations_problem(p_content_type, p_translations, true)',
      'content_apply_fields',
      'content_replace_translations',
      'content_authored_snapshot(p_content_type, p_content_id);\n  v_changed',
      "raise exception 'NO_CHANGES'",
      "v_current + 1, 'published'",
      'delete from public.content_drafts',
      "values (auth.uid(), 'published'",
    ].map((needle) => publish.indexOf(needle));
    expect(order.every((index) => index > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // No exception handler: any failure aborts the whole transaction, live content unchanged.
    expect(publish).not.toMatch(/\bexception\s+when\b/i);
    expect(sql).toMatch(/drop function if exists public\.admin_publish_content\(text, text, jsonb, int\);/);
  });

  it('translation-only publish is a real change (changed_fields includes translations), not NO_CHANGES', () => {
    const old = fs.readFileSync(path.join(root, 'supabase/migrations/20261004000002_content_revisions.sql'), 'utf8');
    expect(old).toMatch(/select 'translations' where coalesce\(p_before->'translations'/);
    expect(fn('content_replace_translations')).toMatch(/delete from public\.content_translations where content_type = p_type and content_id = p_id;\s*insert into public\.content_translations/);
  });

  it('server translation validation: languages, allowed fields, status, bounds, duplicates, empty on publish', () => {
    const rules = fn('content_translations_problem');
    for (const code of ['translation_language', 'translation_field:', 'translation_status', 'translation_too_long', 'translation_duplicate', 'too_many_translations', 'translation_empty:']) expect(rules).toContain(code);
    expect(rules).toMatch(/if p_for_publish and btrim/);
  });

  it('rollback restores fields + translations together as a NEW revision', () => {
    const restore = fn('admin_restore_revision');
    expect(restore).toContain("content_apply_fields(p_content_type, p_content_id, v_target->'fields')");
    expect(restore).toContain("content_replace_translations(p_content_type, p_content_id, coalesce(v_target->'translations'");
    expect(restore).toMatch(/v_current \+ 1, 'restored', p_revision_number/);
    expect(restore).not.toMatch(/delete from public\.content_revisions|update public\.content_revisions/);
  });

  it("What's New: only a change to the REVIEWED set of a published/restored content counts; drafts never do", () => {
    expect(fn('content_reviewed_translations')).toContain("where t->>'status' = 'reviewed'");
    const touch = fn('content_touch_for_translations');
    expect(touch).toContain('if p_before is null then return; end if;');
    expect(touch).toMatch(/is not distinct from public\.content_reviewed_translations\(p_after\) then return/);
    expect(fn('admin_publish_content')).toContain('content_touch_for_translations');
    expect(fn('admin_restore_revision')).toContain('content_touch_for_translations');
  });

  it('normal users cannot write: admin role on every RPC, internal helpers revoked, culture direct writes refused', () => {
    for (const name of ['admin_save_content_draft', 'admin_get_content_draft', 'admin_publish_content', 'admin_restore_revision', 'admin_upsert_content_translation', 'admin_delete_content_translation'])
      expect(fn(name)).toContain("perform public.require_admin_role(array['super_admin', 'content_editor'])");
    for (const name of ['content_touch_for_translations', 'content_replace_translations']) expect(sql).toContain(`revoke all on function public.${name}(`);
    for (const name of ['admin_upsert_content_translation', 'admin_delete_content_translation'])
      expect(fn(name)).toContain("if p_content_type in ('culture_item', 'culture_material') then raise exception 'USE_REVISION_PUBLISH'");
    expect(sql).not.toMatch(/p_changed_by|p_editor|p_user_id/);
  });

  it('revision snapshot already includes translations as {language, field, value, status}', () => {
    const old = fs.readFileSync(path.join(root, 'supabase/migrations/20261004000002_content_revisions.sql'), 'utf8');
    expect(old).toContain("jsonb_build_object('language', t.language, 'field', t.field, 'value', t.value, 'status', t.status)");
  });
});
