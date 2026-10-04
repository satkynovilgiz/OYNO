import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import type { CultureItemRow } from '@/services/content/types';

import { GLOSSARY, KEY_TERMS_BY_ITEM, glossaryRoute } from './glossaryData';
import { keyTermsFor, previewOf, resolveGlossary, searchGlossary, validateGlossary } from './glossaryModel';
import { seededCultureItems } from './seededCultureItems';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));

const ROOT = path.join(__dirname, '../../../..');
const SEEDED = seededCultureItems(ROOT);
const ROWS = [...SEEDED.values()] as unknown as CultureItemRow[];
const translations = (lang: 'en' | 'ru') => JSON.parse(fs.readFileSync(path.join(ROOT, `content/translations/culture_batch1.${lang}.json`), 'utf8')) as Record<string, Record<string, string>>;
const EN = translations('en');
const RU = translations('ru');
const source = (file: string) => fs.readFileSync(path.join(__dirname, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('Glossary - source integrity', () => {
  it('passes the validator against the seeded content (sources, fields, ids, terms, routes, key terms)', () => {
    expect(validateGlossary(GLOSSARY, { items: SEEDED, routes: new Set(['culture_item']) })).toEqual([]);
    expect(fs.existsSync(path.join(ROOT, 'src/app/culture/item/[itemId]/index.tsx'))).toBe(true);
    expect(GLOSSARY.length).toBeGreaterThanOrEqual(10);
    expect(GLOSSARY.length).toBeLessThanOrEqual(20);
  });

  it('every source field holds real authored text, and the term appears in its source', () => {
    for (const entry of GLOSSARY) {
      const row = SEEDED.get(entry.sourceContentId)!;
      const text = String(row[entry.sourceField] ?? '');
      expect(text.trim().length).toBeGreaterThan(20);
      const names = [row.title, ...(row.alt_names ?? '').split(','), text].join(' ').toLocaleLowerCase();
      expect(names).toContain(entry.term.toLocaleLowerCase().slice(0, 4));
    }
  });

  it('no unverified source and no source resting on a flagged claim (komuz, kochkor muyuz, shyrdak colours)', () => {
    for (const entry of GLOSSARY) expect(SEEDED.get(entry.sourceContentId)!.accuracy_level).not.toBe('unverified');
    const sources = GLOSSARY.map((entry) => entry.sourceContentId);
    for (const excluded of ['komuz-overview', 'oymo-kochkor-muyuz', 'shyrdak-tustor']) expect(sources).not.toContain(excluded);
  });

  it('the validator catches duplicates, missing sources, empty fields and unknown key terms', () => {
    const bad = [GLOSSARY[0], { ...GLOSSARY[0] }, { ...GLOSSARY[1], id: 'x', term: 'Новый', sourceContentId: 'gone' }];
    const problems = validateGlossary(bad, { items: SEEDED, routes: new Set(['culture_item']) });
    expect(problems).toEqual(expect.arrayContaining([`duplicate id ${GLOSSARY[0].id}`, `duplicate term ${GLOSSARY[0].term}`, 'x: source gone missing']));
    const emptied = new Map(SEEDED);
    emptied.set('boz-uy-tunduk', { ...SEEDED.get('boz-uy-tunduk')!, cultural_meaning: null });
    expect(validateGlossary(GLOSSARY, { items: emptied, routes: new Set(['culture_item']) })).toContain('tunduk: field cultural_meaning empty');
  });
});

describe('Glossary - runtime behaviour', () => {
  const resolved = resolveGlossary(ROWS);

  it('every entry resolves; a missing source or emptied field hides the entry safely', () => {
    expect(resolved.map((entry) => entry.entry.id)).toEqual(GLOSSARY.map((entry) => entry.id));
    const without = resolveGlossary(ROWS.filter((row) => row.id !== 'boz-uy-tunduk'));
    expect(without.find(({ entry }) => entry.id === 'tunduk')).toBeUndefined();
    expect(resolveGlossary(undefined)).toEqual([]);
  });

  it('the definition IS the authored field (no generated text); previews only truncate', () => {
    const tunduk = resolved.find(({ entry }) => entry.id === 'tunduk')!;
    expect(tunduk.definition).toBe(String(SEEDED.get('boz-uy-tunduk')!.cultural_meaning).trim());
    expect(previewOf('а'.repeat(200))).toBe(`${'а'.repeat(140)}…`);
    for (const file of ['glossaryModel.ts', 'glossaryData.ts', 'GlossaryScreen.tsx', 'GlossaryTermScreen.tsx', 'KeyTermsSection.tsx']) {
      expect(source(file)).not.toMatch(/openai|anthropic|generate|fetch\(|supabase/i);
    }
  });

  it('verification is inherited from the source (same SourcesAndNotes, same level)', () => {
    expect(source('GlossaryTermScreen.tsx')).toMatch(/<SourcesAndNotes contentType="culture_item" level=\{item\.accuracy_level\} sources=\{item\.sources\} contentId=\{item\.id\} \/>/);
  });

  it('alternate names come only from authored alt_names (item-title terms)', () => {
    expect(resolved.find(({ entry }) => entry.id === 'kok-boru')!.alternateNames).toEqual(['Улак тартыш']);
    expect(resolved.find(({ entry }) => entry.id === 'kerege')!.alternateNames).toEqual([]);
  });

  it('search: Cyrillic and Search 3.0 transliteration (tunduk -> Түндүк)', () => {
    expect(searchGlossary(resolved, 'түндүк')[0].entry.id).toBe('tunduk');
    expect(searchGlossary(resolved, 'тундук')[0].entry.id).toBe('tunduk');
    expect(searchGlossary(resolved, 'tunduk')[0].entry.id).toBe('tunduk');
    expect(searchGlossary(resolved, 'kok boru')[0].entry.id).toBe('kok-boru');
    expect(searchGlossary(resolved, 'улак')[0].entry.id).toBe('kok-boru');
    expect(searchGlossary(resolved, 'zzz')).toEqual([]);
    expect(source('glossaryModel.ts')).toMatch(/rankSearchResults\(asCatalog, query\)/);
  });

  it('Key terms: explicit mapping only, never the article itself, no auto-linking', () => {
    expect(keyTermsFor('boz-uy-overview', resolved).map(({ entry }) => entry.id)).toEqual(KEY_TERMS_BY_ITEM['boz-uy-overview']);
    expect(keyTermsFor('boz-uy-karkas', resolved).map(({ entry }) => entry.id)).toEqual(['tunduk']);
    expect(keyTermsFor('clothing-chapan', resolved)).toEqual([]);
    const detail = fs.readFileSync(path.join(__dirname, '../CultureItemDetailScreen.tsx'), 'utf8');
    expect(detail).toMatch(/<KeyTermsSection itemId=\{item\.id\} \/>/);
    expect(detail).not.toMatch(/GLOSSARY\.(map|forEach)|replace\([^)]*term/);
    expect(glossaryRoute('tunduk')).toBe('/culture/glossary/tunduk');
  });

  it('KG / RU / EN: definitions use reviewed translations where they exist, Kyrgyz fallback otherwise (honest note)', () => {
    const translated = GLOSSARY.filter((entry) => EN[entry.sourceContentId]?.[entry.sourceField] && RU[entry.sourceContentId]?.[entry.sourceField]).map((entry) => entry.id);
    expect(translated).toEqual(['boz-uy', 'tunduk', 'kerege', 'uuk', 'tuurduk', 'uzuk', 'ak-orgoo', 'shyrdak', 'oyum', 'eer', 'kok-boru', 'kyz-kuumai', 'oodarysh']);
    expect(source('GlossaryTermScreen.tsx')).toMatch(/<KyrgyzOnlyNote status=\{item\.translation\?\.status\}/);
    for (const dict of [kg, ru, en]) {
      const glossary = (dict as unknown as { glossary: Record<string, string> }).glossary;
      for (const key of ['title', 'keyTerms', 'learnMore', 'termA11y', 'searchPlaceholder', 'noResults']) expect(glossary[key]).toBeTruthy();
    }
  });

  it('no private data: the glossary reads only public culture content', () => {
    for (const file of ['useGlossary.ts', 'glossaryModel.ts', 'GlossaryScreen.tsx', 'GlossaryTermScreen.tsx']) {
      expect(source(file)).not.toMatch(/useJournalStore|useFavoritesStore|useAuthStore|email/);
    }
  });
});
