import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import { cultureItemImages } from '@/features/culture/data';
import type { CultureItemRow } from '@/services/content/types';

import { COMPARE_FIELDS, COMPARE_LABEL_KEY, compareRoute, compareRows, comparisonById, CULTURE_COMPARISONS, validateComparisons, type CultureComparison } from './cultureCompare';

const row = (id: string, fields: Partial<CultureItemRow>, level: CultureItemRow['accuracy_level'] = 'partially_verified'): CultureItemRow =>
  ({ id, title: id, accuracy_level: level, sources: [`https://example.org/${id}`], ...fields }) as CultureItemRow;

/** Field presence of the real rows, as read when the pairs were curated. */
const FULL = { origin: 'o', history: 'h', cultural_meaning: 'm', when_used: 'w', traditional_method: 't', objects_used: 'x', modern_status: 's' };
const CURATED_ROWS: CultureItemRow[] = [
  row('shyrdak-craft', { origin: 'o', history: 'h', traditional_method: 't', modern_status: 's' }),
  row('shyrdak-ala-kiyiz', { origin: 'o', cultural_meaning: 'm', when_used: 'w', traditional_method: 't', objects_used: 'x', modern_status: 's' }),
  row('horse-kok-boru', FULL),
  row('horse-kyz-kuumai', FULL),
  row('horse-oodarysh', FULL),
  row('clothing-ak-kalpak', { cultural_meaning: 'm', when_used: 'w', objects_used: 'x', modern_status: 's' }),
  row('clothing-tebetey', { cultural_meaning: 'm', when_used: 'w', objects_used: 'x' }),
];
const hasImage = (id: string) => !!cultureItemImages[id]?.[0];

describe('Culture Compare', () => {
  it('ships 3-5 valid curated pairs (items, fields, images, child fields, no duplicates)', () => {
    expect(CULTURE_COMPARISONS.length).toBeGreaterThanOrEqual(3);
    expect(CULTURE_COMPARISONS.length).toBeLessThanOrEqual(5);
    expect(validateComparisons(CULTURE_COMPARISONS, CURATED_ROWS, hasImage)).toEqual([]);
  });

  it('flags a missing item, a field one side lacks, a missing image and duplicate pairs', () => {
    const pair: CultureComparison = { id: 'x', leftItemId: 'a', rightItemId: 'b', fields: ['origin', 'history'], childFields: ['origin', 'history'] };
    const rows = [row('a', { origin: 'o', history: 'h' }), row('b', { origin: 'o' })];
    const problems = validateComparisons([pair, { ...pair, id: 'y', leftItemId: 'b', rightItemId: 'a' }, { ...pair, id: 'z', rightItemId: 'gone' }], rows, (id) => id === 'a');
    expect(problems).toEqual(expect.arrayContaining(['x: b has no history', 'x: no image for b', 'y: duplicate pair', 'z: missing item gone']));
  });

  it('a field is shown only when BOTH sides have authored text (live check)', () => {
    const pair = comparisonById('kok-boru-kyz-kuumai')!;
    const left = row('horse-kok-boru', FULL);
    const right = row('horse-kyz-kuumai', { ...FULL, history: '   ', objects_used: null });
    const fields = compareRows(pair, left, right, 'adult').map((entry) => entry.field);
    expect(fields).not.toContain('history');
    expect(fields).not.toContain('objects_used');
    expect(fields).toContain('origin');
  });

  it('shows each side’s own authored text verbatim - nothing generated, no ranking words', () => {
    const pair = comparisonById('shyrdak-ala-kiyiz')!;
    const rows = compareRows(pair, row('shyrdak-craft', { origin: 'Left authored.', traditional_method: 'L', modern_status: 'L2' }), row('shyrdak-ala-kiyiz', { origin: 'Right authored.', traditional_method: 'R', modern_status: 'R2' }), 'teen');
    expect(rows[0]).toEqual({ field: 'origin', left: 'Left authored.', right: 'Right authored.' });
    const source = ['cultureCompare.ts', 'CultureCompareScreen.tsx', 'compareShare.tsx'].map((file) => fs.readFileSync(path.join(__dirname, file), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '')).join('\n');
    expect(source).not.toMatch(/main difference|\bbetter\b|\bolder\b|more authentic|\bai\b|summar/i);
    for (const dict of [en, ru, kg]) expect(JSON.stringify((dict as unknown as { compare: unknown }).compare)).not.toMatch(/better|older|authentic|лучше|древнее|подлинн|жакшыраак/i);
  });

  it('children get 2-3 simple fields; the facts are the same', () => {
    for (const pair of CULTURE_COMPARISONS) {
      const left = CURATED_ROWS.find((item) => item.id === pair.leftItemId)!;
      const right = CURATED_ROWS.find((item) => item.id === pair.rightItemId)!;
      const child = compareRows(pair, left, right, 'child');
      expect(child.length).toBeGreaterThanOrEqual(2);
      expect(child.length).toBeLessThanOrEqual(3);
      const adult = compareRows(pair, left, right, 'adult');
      for (const entry of child) expect(adult).toContainEqual(entry);
    }
  });

  it('each side keeps its own verification and sources (never merged)', () => {
    const source = fs.readFileSync(path.join(__dirname, 'CultureCompareScreen.tsx'), 'utf8');
    expect(source.match(/<SourcesAndNotes contentType="culture_item" level=\{item\.accuracy_level\} sources=\{item\.sources\} contentId=\{item\.id\} \/>/g)).toHaveLength(1);
    expect(source).toMatch(/\[left, right\]\.map\(\(item\) => \(\s*<View key=\{`more-/);
    expect(source).toMatch(/verificationCopyKey\(normalizeVerification\(item\.accuracy_level\)\)/);
  });

  it('Kyrgyz fallback is shown per side, using the existing translation status', () => {
    const source = fs.readFileSync(path.join(__dirname, 'CultureCompareScreen.tsx'), 'utf8');
    expect(source).toMatch(/<SideNote item=\{left\}/);
    expect(source).toMatch(/<SideNote item=\{right\}/);
    expect(source).toMatch(/item\.translation\?\.status !== 'fallback_to_kg'/);
  });

  it('routes: list, pair and "Open full story" exist; unknown ids are safe', () => {
    const app = path.join(__dirname, '../../../app');
    expect(fs.existsSync(path.join(app, 'culture/compare/index.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(app, 'culture/compare/[id].tsx'))).toBe(true);
    expect(fs.existsSync(path.join(app, 'culture/item/[itemId]/index.tsx'))).toBe(true);
    expect(compareRoute('kok-boru-kyz-kuumai')).toBe('/culture/compare/kok-boru-kyz-kuumai');
    expect(comparisonById('../../etc')).toBeNull();
    expect(comparisonById(undefined)).toBeNull();
  });

  it('share card: two images, two titles, "Compare in OYNO" - no paragraphs', () => {
    const source = fs.readFileSync(path.join(__dirname, 'compareShare.tsx'), 'utf8');
    expect(source).not.toMatch(/subtitle:|excerpt:|row\.left|row\.right|<Text/);
  });

  it('KG / RU / EN copy + field labels for every compare field', () => {
    for (const dict of [en, ru, kg]) {
      const block = (dict as unknown as { compare: Record<string, string> }).compare;
      for (const key of ['title', 'entry', 'intro', 'openStory', 'shareLabel', 'unavailable']) expect(block[key]).toBeTruthy();
      const item = (dict as unknown as { culture: { item: Record<string, string> } }).culture.item;
      for (const field of COMPARE_FIELDS) expect(item[COMPARE_LABEL_KEY[field].split('.').pop()!]).toBeTruthy();
    }
  });
});
