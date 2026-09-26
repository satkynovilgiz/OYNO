import * as fs from 'fs';
import * as path from 'path';

import { buildDailyTextBlocks } from '@/features/daily/dailyContent';
import { buildSavedView } from '@/features/saved/savedModel';

import { buildCultureItemCatalog } from './contentCatalog';
import { buildTranslationIndex, CULTURE_ITEM_BODY_FIELDS, localizeCultureItem, localizeMaterial, localizeQuest, localizeRegionFacts, type TranslationRow } from './localizedContent';
import type { CultureItemRow, CultureMaterialRow, ExploreRegionRow, QuestRow } from './types';

const ROOT = path.join(__dirname, '../../..');
const readJson = (file: string) => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));

function item(overrides: Partial<CultureItemRow> = {}): CultureItemRow {
  return {
    id: 'boz-uy-tunduk', category_id: 'boz-uy', subgroup: null, title: 'Түндүк', alt_names: null, type_label: null,
    origin: null, history: null, cultural_meaning: 'Кыргызча текст.', when_used: null, ingredients: null, traditional_method: 'Ыкма.',
    who_participates: null, objects_used: null, regional_notes: null, modern_status: null, fun_facts: null,
    simple_summary_kg: null, simple_summary_ru: null, simple_summary_en: null, accuracy_level: 'partially_verified', sources: null, sort_order: 1, image_url: null,
    ...overrides,
  } as CultureItemRow;
}

const row = (content_id: string, language: 'ru' | 'en', field: string, value: string, content_type: TranslationRow['content_type'] = 'culture_item'): TranslationRow => ({ content_type, content_id, language, field, value });

const FULL = buildTranslationIndex([
  row('boz-uy-tunduk', 'ru', 'title', 'Түндүк'),
  row('boz-uy-tunduk', 'ru', 'cultural_meaning', 'Русский текст.'),
  row('boz-uy-tunduk', 'ru', 'traditional_method', 'Способ.'),
  row('boz-uy-tunduk', 'en', 'title', 'Tunduk'),
  row('boz-uy-tunduk', 'en', 'cultural_meaning', 'English text.'),
  // EN is missing traditional_method on purpose -> must not mix languages.
]);

describe('localized culture items', () => {
  it('KG: canonical row, unchanged', () => {
    const result = localizeCultureItem(item(), 'kg', FULL);
    expect(result.cultural_meaning).toBe('Кыргызча текст.');
    expect(result.translation?.status).toBe('available');
  });

  it('RU: a complete reviewed translation replaces title and every authored field', () => {
    const result = localizeCultureItem(item(), 'ru', FULL);
    expect(result.cultural_meaning).toBe('Русский текст.');
    expect(result.traditional_method).toBe('Способ.');
    expect(result.translation).toMatchObject({ language: 'ru', status: 'available', titleLocalized: true });
  });

  it('EN with one field missing: title localizes, body stays wholly Kyrgyz (never mixed) and says so', () => {
    const result = localizeCultureItem(item(), 'en', FULL);
    expect(result.title).toBe('Tunduk');
    expect(result.cultural_meaning).toBe('Кыргызча текст.');
    expect(result.traditional_method).toBe('Ыкма.');
    expect(result.translation?.status).toBe('fallback_to_kg');
  });

  it('no translation at all: Kyrgyz with fallback status; no authored body: missing', () => {
    expect(localizeCultureItem(item(), 'en', buildTranslationIndex([])).translation?.status).toBe('fallback_to_kg');
    const empty = item({ cultural_meaning: null, traditional_method: null });
    expect(localizeCultureItem(empty, 'ru', FULL).translation?.status).toBe('missing');
  });

  it('never modifies the source row object', () => {
    const source = item();
    localizeCultureItem(source, 'ru', FULL);
    expect(source.cultural_meaning).toBe('Кыргызча текст.');
    expect(source.translation).toBeUndefined();
  });
});

describe('materials, facts and quests use the same resolver', () => {
  it('material body localizes all-or-nothing', () => {
    const material = { id: 'm', title: 'Калпак', description: 'Кыскача.', body: 'Текст.', kind: 'reading', duration_minutes: 3, sort_order: 1, accuracy_level: 'unverified', sources: null, image_url: null } as unknown as CultureMaterialRow;
    const index = buildTranslationIndex([row('m', 'ru', 'title', 'Калпак', 'culture_material'), row('m', 'ru', 'body', 'Текст RU.', 'culture_material')]);
    expect(localizeMaterial(material, 'ru', index)).toMatchObject({ body: 'Текст.', translation: { status: 'fallback_to_kg' } });
  });

  it('destination facts are all translated or all Kyrgyz', () => {
    const region = { id: 'osh', facts: ['Биринчи.', 'Экинчи.'] } as ExploreRegionRow;
    const partial = buildTranslationIndex([row('osh', 'en', 'fact.0', 'First.', 'explore_region')]);
    expect(localizeRegionFacts(region, 'en', partial)).toEqual({ facts: ['Биринчи.', 'Экинчи.'], status: 'fallback_to_kg' });
    const full = buildTranslationIndex([row('osh', 'en', 'fact.0', 'First.', 'explore_region'), row('osh', 'en', 'fact.1', 'Second.', 'explore_region')]);
    expect(localizeRegionFacts(region, 'en', full)).toEqual({ facts: ['First.', 'Second.'], status: 'available' });
  });

  it('quest text follows the same format', () => {
    const quest = { id: 'q', character_id: 'bek', title: 'Аталыш', subtitle: 'Сүрөттөмө', total_count: 3, cta_label: 'Улант' } as QuestRow;
    expect(localizeQuest(quest, 'ru', buildTranslationIndex([])).translation?.status).toBe('fallback_to_kg');
  });
});

describe('surfaces read the same localized title', () => {
  it('Search indexes KG + reviewed RU/EN titles and alternate names', () => {
    const [entry] = buildCultureItemCatalog([localizeCultureItem(item({ alt_names: 'Чамгарак' }), 'ru', FULL)], []);
    expect(entry.title).toBe('Түндүк');
    expect(entry.searchText).toEqual(expect.arrayContaining(['Түндүк', 'Tunduk', 'Чамгарак']));
  });

  it('Daily reports the real language of its text', () => {
    const ruBlocks = buildDailyTextBlocks(localizeCultureItem(item(), 'ru', FULL), 'adult', 'ru');
    expect(ruBlocks.every((block) => block.lang === 'ru')).toBe(true);
    const enBlocks = buildDailyTextBlocks(localizeCultureItem(item(), 'en', FULL), 'adult', 'en');
    expect(enBlocks.every((block) => block.lang === 'kg')).toBe(true);
  });

  it('Saved shows the localized title from the same catalog', () => {
    const catalog = buildCultureItemCatalog([localizeCultureItem(item(), 'en', FULL)], []);
    const view = buildSavedView({ favoriteIds: ['culture_item:boz-uy-tunduk'], catalog, isOffline: () => false, recent: [] });
    expect(view.sections[0].entries[0].item.title).toBe('Tunduk');
  });
});

describe('translation content files (batch 1)', () => {
  const ru = readJson('content/translations/culture_batch1.ru.json');
  const en = readJson('content/translations/culture_batch1.en.json');
  const facts = readJson('content/translations/explore_facts_batch1.json');

  it('RU and EN cover exactly the same items and fields', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ru).sort());
    for (const id of Object.keys(ru)) expect(Object.keys(en[id]).sort()).toEqual(Object.keys(ru[id]).sort());
  });

  it('only real culture_items columns are translated (no invented fields)', () => {
    const allowed = new Set<string>(['title', 'alt_names', ...CULTURE_ITEM_BODY_FIELDS]);
    for (const data of [ru, en]) for (const fields of Object.values(data) as Record<string, string>[]) for (const field of Object.keys(fields)) expect(allowed.has(field)).toBe(true);
  });

  it('destinations with claims awaiting verification are not translated', () => {
    const flagged = ['son-kol', 'ysyk-kol', 'sary-chelek', 'talas', 'bishkek', 'batken', 'ala-too', 'alay'];
    for (const id of flagged) expect(facts[id]).toBeUndefined();
  });

  it('the seed only inserts into content_translations - never duplicates or edits source rows', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'supabase/migrations/20260927000002_content_translations_batch1.sql'), 'utf8');
    expect(sql).not.toMatch(/\b(update|insert into)\s+public\.(culture_items|culture_materials|explore_regions|quests)\b/i);
    expect(sql).toMatch(/insert into public\.content_translations/);
  });
});
