import * as fs from 'fs';
import * as path from 'path';

import { coverageFor, EMPTY_FILTER, filterAdminRows, isDirty, isValidSourceUrl, previewFor, validateAdminValues, validateTranslation, valuesToRow, type AdminTranslationRow } from './adminModel';
import { ADMIN_SECTIONS, getAdminSection, rowToFormValues } from './sections';

jest.mock('@/services/admin/adminService', () => ({ fetchTable: jest.fn(), fetchViaRpc: jest.fn() }));

const ROOT = path.join(__dirname, '../../..');
const t = (field: string, language: 'ru' | 'en', status: 'draft' | 'reviewed', value = 'x', id = 'boz-uy'): AdminTranslationRow => ({ id: `culture_item|${id}|${language}|${field}`, content_type: 'culture_item', content_id: id, language, field, value, status });
const item = { id: 'boz-uy', title: 'Боз үй', history: 'Тарых', cultural_meaning: 'Маани', accuracy_level: 'partially_verified', sources: [] };

describe('admin gate', () => {
  it('every admin route renders inside AdminGate (deep links included); the gate shows Not Found to non-admins', () => {
    for (const file of fs.readdirSync(path.join(ROOT, 'src/app/admin'))) {
      expect(fs.readFileSync(path.join(ROOT, 'src/app/admin', file), 'utf8')).toMatch(/<AdminGate>/);
    }
    const gate = fs.readFileSync(path.join(__dirname, 'AdminGate.tsx'), 'utf8');
    expect(gate).toMatch(/if \(!role\) return <NotFoundState/);
  });

  it('every write goes through an admin RPC that exists in a migration', () => {
    const sql = fs.readdirSync(path.join(ROOT, 'supabase/migrations')).map((file) => fs.readFileSync(path.join(ROOT, 'supabase/migrations', file), 'utf8')).join('\n');
    for (const section of ADMIN_SECTIONS) {
      for (const rpc of [section.upsertRpc, section.deleteRpc]) {
        expect(rpc.startsWith('admin_')).toBe(true);
        expect(sql).toMatch(new RegExp(`function public\\.${rpc}\\(`));
      }
    }
  });
});

describe('section config', () => {
  it('every section has a group, an id field and maps every field on save', () => {
    for (const section of ADMIN_SECTIONS) {
      expect(section.group).toBeTruthy();
      expect(section.fields.some((field) => field.key === section.idField) || section.idField === 'id').toBe(true);
      const params = section.toParams(rowToFormValues(section, null));
      expect(Object.keys(params).every((key) => key.startsWith('p_'))).toBe(true);
    }
  });

  it('save mapping: lists split per line, blanks become null, defaults stay honest', () => {
    const section = getAdminSection('culture_items')!;
    const values = { ...rowToFormValues(section, null), id: 'x', category_id: 'food', title: 'T', sources: 'https://ich.unesco.org/a\n\n https://kg.wikipedia.org/b ' };
    const params = section.toParams(values);
    expect(params.p_sources).toEqual(['https://ich.unesco.org/a', 'https://kg.wikipedia.org/b']);
    expect(params.p_history).toBeNull();
    expect(params.p_accuracy_level).toBe('unverified');
  });
});

describe('translation status', () => {
  it('Kyrgyz complete = title + body; RU/EN complete only when every Kyrgyz field is reviewed', () => {
    const all = ['title', 'history', 'cultural_meaning'];
    expect(coverageFor('culture_item', item, all.map((field) => t(field, 'ru', 'reviewed')))).toEqual({ kg: 'complete', ru: 'complete', en: 'missing' });
  });

  it('drafts or a partial set are "partial", never "complete"', () => {
    expect(coverageFor('culture_item', item, ['title', 'history', 'cultural_meaning'].map((field) => t(field, 'en', 'draft'))).en).toBe('partial');
    expect(coverageFor('culture_item', item, [t('title', 'en', 'reviewed')]).en).toBe('partial');
  });

  it('a row existing with an empty value, or for another item, does not count', () => {
    expect(coverageFor('culture_item', item, [t('title', 'ru', 'reviewed', '   '), t('title', 'ru', 'reviewed', 'x', 'other')]).ru).toBe('missing');
  });

  it('destinations: names live on the row, facts in translations', () => {
    const region = { id: 'naryn', name_kg: 'Нарын', name_ru: 'Нарын', name_en: '', facts: ['Факт'] };
    const fact: AdminTranslationRow = { id: 'x', content_type: 'explore_region', content_id: 'naryn', language: 'ru', field: 'fact.0', value: 'Факт', status: 'reviewed' };
    expect(coverageFor('explore_region', region, [fact])).toMatchObject({ ru: 'complete', en: 'missing' });
  });

  it('preview uses reviewed translations only and falls back to Kyrgyz as the app does', () => {
    const drafts = ['title', 'history', 'cultural_meaning'].map((field) => t(field, 'ru', 'draft', `RU ${field}`));
    expect(previewFor('culture_item', item, 'ru', drafts)).toMatchObject({ title: 'Боз үй', status: 'fallback_to_kg' });
    const reviewed = drafts.map((row) => ({ ...row, status: 'reviewed' as const }));
    expect(previewFor('culture_item', item, 'ru', reviewed)).toMatchObject({ title: 'RU title', status: 'available' });
  });
});

describe('validation', () => {
  const items = getAdminSection('culture_items')!;
  const base = { ...rowToFormValues(items, null), id: 'x', category_id: 'food', title: 'Title' };

  it('required title', () => {
    expect(validateAdminValues(items, { ...base, title: ' ' }, {})).toMatch(/Title is required/);
  });

  it('invalid source URL', () => {
    expect(isValidSourceUrl('https://ich.unesco.org/en/RL/x')).toBe(true);
    expect(isValidSourceUrl('unesco.org')).toBe(false);
    expect(isValidSourceUrl('javascript:alert(1)')).toBe(false);
    expect(isValidSourceUrl('https://no spaces.org')).toBe(false);
    expect(validateAdminValues(items, { ...base, sources: 'not a url' }, {})).toMatch(/Not a valid source URL/);
  });

  it('verified requires a source', () => {
    expect(validateAdminValues(items, { ...base, accuracy_level: 'verified', sources: '' }, {})).toBeTruthy();
    expect(validateAdminValues(items, { ...base, accuracy_level: 'verified', sources: 'https://ich.unesco.org/x' }, {})).toBeNull();
  });

  it('quest steps: broken quest / target ids are rejected; ids not yet loaded are not called broken', () => {
    const steps = getAdminSection('quest_steps')!;
    const step = { ...rowToFormValues(steps, null), id: 's', quest_id: 'lost-shyrdak', step_type: 'OPEN_CULTURE_ITEM', target_id: 'no-such-item', title_kg: 'Кадам' };
    const catalog = { quests: new Set(['lost-shyrdak']), culture_items: new Set(['boz-uy-overview']) };
    expect(validateAdminValues(steps, step, catalog)).toMatch(/Target ID: "no-such-item" doesn't exist in culture_items/);
    expect(validateAdminValues(steps, { ...step, target_id: 'boz-uy-overview' }, catalog)).toBeNull();
    expect(validateAdminValues(steps, { ...step, quest_id: 'ghost' }, catalog)).toMatch(/Quest ID/);
    expect(validateAdminValues(steps, step, {})).toBeNull();
  });

  it('translations: content id must exist; an empty translation is not saved', () => {
    const translations = getAdminSection('content_translations')!;
    const row = { ...rowToFormValues(translations, null), content_type: 'culture_item', content_id: 'ghost', language: 'ru', field: 'title', value: 'x', status: 'draft' };
    expect(validateAdminValues(translations, row, { culture_items: new Set(['boz-uy']) })).toMatch(/Content ID/);
    expect(validateTranslation('  ', 'reviewed')).toBeTruthy();
    expect(validateTranslation('Юрта', 'reviewed')).toBeNull();
  });
});

describe('list, search and unsaved changes', () => {
  const section = getAdminSection('culture_items')!;
  const rows = [item, { ...item, id: 'shyrdak', title: 'Шырдак', accuracy_level: 'verified' }];

  it('filters by title, id, verification and localization', () => {
    const cov = (row: Record<string, unknown>) => coverageFor('culture_item', row, []);
    expect(filterAdminRows(section, rows, { ...EMPTY_FILTER, query: 'шыр' }, cov).map((row) => row.id)).toEqual(['shyrdak']);
    expect(filterAdminRows(section, rows, { ...EMPTY_FILTER, query: 'BOZ-UY' }, cov).map((row) => row.id)).toEqual(['boz-uy']);
    expect(filterAdminRows(section, rows, { ...EMPTY_FILTER, verification: 'verified' }, cov).map((row) => row.id)).toEqual(['shyrdak']);
    expect(filterAdminRows(section, rows, { ...EMPTY_FILTER, localization: { language: 'ru', coverage: 'missing' } }, cov)).toHaveLength(2);
  });

  it('dirty only when something actually changed', () => {
    const values = rowToFormValues(section, item);
    expect(isDirty(values, { ...values })).toBe(false);
    expect(isDirty(values, { ...values, title: 'Боз үй!' })).toBe(true);
    expect(valuesToRow(section, { ...values, sources: 'a\nb' }).sources).toEqual(['a', 'b']);
  });
});
