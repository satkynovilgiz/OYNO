import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import type { CultureItemRow } from '@/services/content/types';

import { NOW_FIELDS, THEN_FIELDS, THEN_NOW_PRESENTATION, thenAndNowFor, thenNowRoute } from './thenAndNow';
import { buildThenNowShareCard } from './thenNowShare';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));

const item = (fields: Partial<CultureItemRow>): CultureItemRow => ({ id: 'horse-eer', title: 'Ээр', accuracy_level: 'partially_verified', sources: ['https://example.org/x'], ...fields }) as CultureItemRow;
const LONG = 'Ээр - жылкычылыктын негизги буюму. '.repeat(40);
const source = (file: string) => fs.readFileSync(path.join(__dirname, file), 'utf8');

describe('Culture Then & Now', () => {
  it('eligible: a real historical field AND modern_status; text kept exactly as authored', () => {
    const model = thenAndNowFor(item({ history: ' Тарых. ', traditional_method: 'Ыкма.', modern_status: 'Бүгүн да колдонулат.' }));
    expect(model).toEqual({
      then: [
        { field: 'history', text: 'Тарых.' },
        { field: 'traditional_method', text: 'Ыкма.' },
      ],
      now: [{ field: 'modern_status', text: 'Бүгүн да колдонулат.' }],
    });
  });

  it('missing modern content -> no module (removing modern_status in admin removes it)', () => {
    expect(thenAndNowFor(item({ history: 'Тарых.', modern_status: null as unknown as string }))).toBeNull();
    expect(thenAndNowFor(item({ history: 'Тарых.', modern_status: '   ' }))).toBeNull();
  });

  it('missing historical content -> no module; when_used / cultural_meaning never count as Then', () => {
    expect(thenAndNowFor(item({ when_used: 'Той учурунда.', cultural_meaning: 'Маани.', modern_status: 'Азыр.' }))).toBeNull();
    expect(THEN_FIELDS).toEqual(['history', 'origin', 'traditional_method']);
    expect(NOW_FIELDS).toEqual(['modern_status']);
  });

  it('long text is passed through whole (the article truncates visually, never rewrites)', () => {
    expect(thenAndNowFor(item({ origin: LONG, modern_status: LONG }))!.then[0].text).toBe(LONG.trim());
    expect(source('ThenAndNowSection.tsx')).toMatch(/numberOfLines=\{lines\}/);
  });

  it('no new factual strings: no dates, years, timelines or generated text in the feature', () => {
    for (const file of ['thenAndNow.ts', 'ThenAndNowSection.tsx', 'ThenAndNowScreen.tsx', 'thenNowShare.ts']) {
      // Code only - comments may explain what the feature deliberately doesn't do.
      const code = source(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(code).not.toMatch(/\b(1[0-9]{3}|20[0-9]{2})\b/);
      expect(code).not.toMatch(/summar(y|ize)\(|generate|openai|anthropic|timeline/i);
    }
    for (const dict of [en, ru, kg]) expect(JSON.stringify((dict as { thenNow: unknown }).thenNow)).not.toMatch(/\d{3,4}/);
  });

  it('verification and sources are the item’s own, unchanged (same SourcesAndNotes)', () => {
    expect(source('ThenAndNowScreen.tsx')).toMatch(/<SourcesAndNotes contentType="culture_item" level=\{item\.accuracy_level\} sources=\{item\.sources\} contentId=\{item\.id\} \/>/);
  });

  it('localization fallback: Kyrgyz body under RU/EN headings always carries the existing note', () => {
    for (const file of ['ThenAndNowSection.tsx', 'ThenAndNowScreen.tsx']) expect(source(file)).toMatch(/<KyrgyzOnlyNote status=\{item\.translation\?\.status\}/);
  });

  it('age presentation: one model, simpler headings and shorter excerpts for younger players', () => {
    expect(THEN_NOW_PRESENTATION.child).toMatchObject({ headings: 'simple', excerptLines: 2 });
    expect(THEN_NOW_PRESENTATION.preteen.headings).toBe('simple');
    expect(THEN_NOW_PRESENTATION.teen.headings).toBe('standard');
    expect(THEN_NOW_PRESENTATION.adult).toMatchObject({ headings: 'standard', editorial: true });
    expect(THEN_NOW_PRESENTATION.adult.excerptLines).toBeGreaterThan(THEN_NOW_PRESENTATION.child.excerptLines);
  });

  it('Then and Now are real headings', () => {
    expect(source('ThenAndNowSection.tsx').match(/accessibilityRole="header"/g)!.length).toBeGreaterThanOrEqual(2);
    expect(source('ThenAndNowScreen.tsx').match(/accessibilityRole="header"/g)!.length).toBeGreaterThanOrEqual(2);
  });

  it('share card: image, title, "Then & Now" - no paragraphs', () => {
    const card = buildThenNowShareCard({ title: 'Ээр', label: 'Мурун жана азыр', image: null });
    expect(Object.keys(card).sort()).toEqual(['fallbackTone', 'imageSource', 'label', 'title']);
    expect(JSON.stringify(card)).not.toMatch(/excerpt|subtitle|history|modern/);
  });

  it('analytics sends only content id and type; route; KG/RU/EN strings', () => {
    expect(source('ThenAndNowScreen.tsx')).toMatch(/track\('culture_then_now_opened', \{ content_id: item\.id, content_type: 'culture_item' \}\)/);
    expect(thenNowRoute('horse-eer')).toBe('/culture/item/horse-eer/then-now');
    for (const dict of [kg, ru, en]) {
      const block = (dict as { thenNow: { title: string; then: { simple: string; standard: string }; now: { simple: string; standard: string } } }).thenNow;
      expect(block.title && block.then.simple && block.then.standard && block.now.simple && block.now.standard).toBeTruthy();
    }
  });
});
