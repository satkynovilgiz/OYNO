import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import type { CultureItemRow } from '@/services/content/types';

import { GLOSSARY } from '../glossaryData';
import { resolveGlossary, type ResolvedGlossaryEntry } from '../glossaryModel';
import { seededCultureItems } from '../seededCultureItems';
import { buildInlineTermIndex, formsFor, inlineDefinition, isWordChar, MAX_TERMS_PER_SECTION, normalizeForMatch, segmentText, selfEntryIds } from './inlineTermIndex';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));

const ROOT = path.join(__dirname, '../../../../..');
const translations = (lang: 'en' | 'ru') => JSON.parse(fs.readFileSync(path.join(ROOT, `content/translations/culture_batch1.${lang}.json`), 'utf8')) as Record<string, Record<string, string>>;
const EN = translations('en');
const RU = translations('ru');
// Seeded rows with their REVIEWED RU/EN titles attached the way the app's resolver does.
const ROWS = ([...seededCultureItems(ROOT).values()] as unknown as CultureItemRow[]).map((row) => ({
  ...row,
  translation: { language: 'kg' as const, status: 'available' as const, titleLocalized: true, titles: { kg: row.title, ...(RU[row.id]?.title ? { ru: RU[row.id].title } : {}), ...(EN[row.id]?.title ? { en: EN[row.id].title } : {}) } },
}));
const RESOLVED = resolveGlossary(ROWS);
const KG = buildInlineTermIndex(RESOLVED, 'kg');
const RU_INDEX = buildInlineTermIndex(RESOLVED, 'ru');
const EN_INDEX = buildInlineTermIndex(RESOLVED, 'en');
const terms = (segments: ReturnType<typeof segmentText>) => segments.filter((segment) => segment.kind === 'term').map((segment) => (segment.kind === 'term' ? `${segment.entryId}:${segment.text}` : ''));
const joined = (segments: ReturnType<typeof segmentText>) => segments.map((segment) => segment.text).join('');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('Inline glossary - matching', () => {
  it('index is built from the curated glossary only (no other source), once per language', () => {
    expect(KG.size).toBeGreaterThanOrEqual(GLOSSARY.length);
    const ids = new Set([...KG.byFirstChar.values()].flat().map((form) => form.entryId));
    for (const id of ids) expect(GLOSSARY.some((entry) => entry.id === id)).toBe(true);
  });

  it('exact term', () => {
    expect(terms(segmentText('Боз үйдүн чокусунда Түндүк турат.', KG))).toEqual(['tunduk:Түндүк']);
  });

  it('explicit alias (authored alt_names only)', () => {
    expect(terms(segmentText('Аны Улак тартыш деп да аташат.', KG))).toEqual(['kok-boru:Улак тартыш']);
    expect(GLOSSARY.find((entry) => entry.id === 'kok-boru')?.aliases?.kg).toEqual(['Улак тартыш']);
    // Every alias is copied from its source item's authored alt_names.
    for (const entry of GLOSSARY) for (const alias of entry.aliases?.kg ?? []) expect(ROWS.find((row) => row.id === entry.sourceContentId)?.alt_names ?? '').toContain(alias);
  });

  it('case normalization (and text is returned untouched)', () => {
    const text = 'ТҮНДҮК жана түндүк';
    const segments = segmentText(text, KG);
    expect(terms(segments)).toEqual(['tunduk:ТҮНДҮК']);
    expect(joined(segments)).toBe(text);
    expect(normalizeForMatch('ТҮНДҮК')).toBe('түндүк');
  });

  it('word boundaries: never a partial word (no inflections, no prefixes)', () => {
    expect(terms(segmentText('Түндүктүн формасы', KG))).toEqual([]);
    expect(terms(segmentText('Чапанчы', KG))).toEqual([]);
    expect(terms(segmentText('ЭлечекТер', KG))).toEqual([]);
    expect(terms(segmentText('(Түндүк),', KG))).toEqual(['tunduk:Түндүк']);
    expect(isWordChar('ү')).toBe(true);
    expect(isWordChar(' ')).toBe(false);
  });

  it('wrong language excluded: Kyrgyz-only sub-terms are not matched in RU/EN text', () => {
    // Кереге has no reviewed RU/EN form, so it is not highlighted in RU/EN text.
    expect(terms(segmentText('Кереге - решётка юрты.', RU_INDEX))).toEqual([]);
    expect(terms(segmentText('Кереге is the lattice wall.', EN_INDEX))).toEqual([]);
    expect(terms(segmentText('Кереге - торчо дубал.', KG))).toEqual(['kerege:Кереге']);
    const kergeEntry = RESOLVED.find(({ entry }) => entry.id === 'kerege')!;
    expect(formsFor(kergeEntry, 'en')).toEqual([]);
  });

  it('RU/EN use the reviewed translated title of the source item', () => {
    const tunduk = RESOLVED.find(({ entry }) => entry.id === 'tunduk')!;
    const enTitle = EN['boz-uy-tunduk']?.title;
    if (enTitle) {
      expect(formsFor(tunduk, 'en')).toContain(enTitle);
      expect(terms(segmentText(`The ${enTitle} crowns the yurt.`, EN_INDEX))).toEqual([`tunduk:${enTitle}`]);
    }
    // No reviewed title -> nothing for that language.
    const unreviewed: ResolvedGlossaryEntry = { ...tunduk, item: { ...tunduk.item, translation: { language: 'kg', status: 'available', titleLocalized: true, titles: { kg: 'Түндүк' } } } };
    expect(formsFor(unreviewed, 'en')).toEqual([]);
  });

  it('multiple occurrences: first per section only; a fresh section highlights again', () => {
    const text = 'Түндүк, кереге жана уук. Түндүк кайра. Кереге кайра.';
    expect(terms(segmentText(text, KG))).toEqual(['tunduk:Түндүк', 'kerege:кереге', 'uuk:уук']);
    const seen = new Set<string>();
    expect(terms(segmentText('Түндүк.', KG, { seen }))).toEqual(['tunduk:Түндүк']);
    expect(terms(segmentText('Түндүк.', KG, { seen }))).toEqual([]);
    expect(terms(segmentText('Түндүк.', KG))).toEqual(['tunduk:Түндүк']);
  });

  it('density cap per section', () => {
    const text = 'Түндүк, кереге, уук, туурдук, үзүк, шырдак, чапан.';
    expect(terms(segmentText(text, KG))).toHaveLength(MAX_TERMS_PER_SECTION);
  });

  it('an article never links its own terms back to itself', () => {
    const exclude = selfEntryIds(RESOLVED, 'boz-uy-karkas');
    expect([...exclude].sort()).toEqual(['kerege', 'uuk']);
    expect(terms(segmentText('Кереге, уук жана түндүк.', KG, { exclude }))).toEqual(['tunduk:түндүк']);
  });

  it('longest form wins (multi-word terms before shorter overlaps)', () => {
    expect(terms(segmentText('Ак өргөө жайы, ак түс.', KG))).toEqual(['ak-orgoo:Ак өргөө']);
  });

  it('article factual content is never changed', () => {
    for (const row of ROWS.slice(0, 40)) for (const field of ['history', 'cultural_meaning', 'origin'] as const) {
      const text = row[field];
      if (typeof text === 'string') expect(joined(segmentText(text, KG))).toBe(text.normalize('NFC'));
    }
  });
});

describe('Inline glossary - definition & age experience', () => {
  const tunduk = RESOLVED.find(({ entry }) => entry.id === 'tunduk')!;
  it('uses the existing authored definition / summary, shortened by age', () => {
    const child = inlineDefinition(tunduk, 'child', 'Короткий summary.');
    expect(child).toMatchObject({ term: 'Түндүк', text: 'Короткий summary.', large: true, showImage: true });
    expect(inlineDefinition(tunduk, 'child', null).text.length).toBeLessThanOrEqual(121);
    expect(inlineDefinition(tunduk, 'preteen', null)).toMatchObject({ showImage: true, large: false });
    const adult = inlineDefinition(tunduk, 'adult', null);
    expect(adult.showImage).toBe(false);
    expect(tunduk.definition.startsWith(adult.text.replace(/…$/, ''))).toBe(true);
  });
});

describe('Inline glossary - integration', () => {
  const item = read('src/features/culture/CultureItemDetailScreen.tsx');
  const material = read('src/features/culture/MaterialDetailScreen.tsx');
  const ui = read('src/features/culture/glossary/inline/InlineGlossary.tsx');

  it('Culture items and materials render sections through GlossaryText in the RENDERED body language', () => {
    expect(item).toContain('<InlineGlossaryProvider articleItemId={item.id}>');
    expect(item).toMatch(/<GlossaryText text=\{item\[field\.key\] as string\} language=\{bodyLanguage\}/);
    expect(item).toMatch(/const bodyLanguage = bodyLanguageFor\(item, i18n\.language\)/);
    expect(material).toContain('<InlineGlossaryProvider articleItemId={null}>');
    expect(material).toMatch(/<GlossaryText text=\{material\.body\} language=\{bodyLanguage\}/);
  });

  it('Reader Mode: the same bodyStyle (text size / line spacing) is passed through', () => {
    expect(item).toMatch(/<GlossaryText [^>]*style=\{\[styles\.paragraph, isChild && styles\.paragraphChild, bodyStyle\]\}/);
    expect(material).toMatch(/<GlossaryText [^>]*style=\{\[styles\.body, bodyStyle\]\}/);
  });

  it('Read & Listen + saved highlights keep working and stay visually distinct', () => {
    // Read & Listen still styles the SECTION container; terms use a dotted underline.
    expect(item).toMatch(/current\.includes\(field\.key as string\) && readListenStyles\.current/);
    expect(material).toContain('bodyNow ? readListenStyles.current : undefined');
    expect(ui).toMatch(/term: \{ textDecorationLine: 'underline', textDecorationStyle: 'dotted'/);
    expect(ui).not.toMatch(/backgroundColor: colors\.(primary|accent)/);
    // Saved passages: whole-section PassageActions are untouched (no text selection in use).
    expect((item.match(/<PassageActions/g) ?? []).length).toBe(1);
    expect(item).not.toMatch(/selectable/);
  });

  it('Reduce Motion, high contrast tokens, accessibility label, analytics without article text', () => {
    expect(ui).toContain("animationType={reducedMotion ? 'none' : 'slide'}");
    expect(ui).toMatch(/accessibilityLabel=\{`\$\{segment\.text\}, \$\{t\('glossary\.inlineTermA11y'\)\}`\}/);
    expect(ui).toContain('accessibilityViewIsModal');
    expect(ui).toMatch(/track\('inline_glossary_opened', \{ glossary_entry_id: entryId \}\)/);
    expect(ui).toContain('router.push(glossaryRoute(resolved.entry.id)');
  });

  it('screen reader string reads "<term>, glossary term" in KG/RU/EN', () => {
    expect(`Түндүк, ${en.glossary.inlineTermA11y}`).toBe('Түндүк, glossary term');
    for (const locale of [kg, ru, en]) for (const key of ['inlineTermA11y', 'inlineTermHint', 'openGlossary'] as const) expect(locale.glossary[key]).toBeTruthy();
  });

  it('performance: the index is cached per language, segments memoized per section', () => {
    expect(ui).toMatch(/let index = cache\.get\(language\)/);
    expect(ui).toMatch(/useMemo\(\(\) => \(glossary \? segmentText/);
  });
});
