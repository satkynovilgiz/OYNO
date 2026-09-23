import type { CultureItemRow } from '@/services/content/types';

import { buildDailyTextBlocks, dailyHasChallenge, firstSentences } from './dailyContent';

const base = {
  id: 'boz-uy-tunduk',
  category_id: 'boz-uy',
  title: 'Түндүк',
  cultural_meaning: 'First sentence. Second sentence. Third sentence.',
  history: 'History text.',
  fun_facts: 'A fun fact.',
  origin: null,
  when_used: null,
  regional_notes: null,
  simple_summary_kg: null,
  simple_summary_ru: null,
  simple_summary_en: null,
} as unknown as CultureItemRow;

describe('firstSentences', () => {
  it('keeps only the opening sentences', () => {
    expect(firstSentences('One. Two! Three?', 2)).toBe('One. Two!');
  });
  it('returns short text unchanged', () => {
    expect(firstSentences('Only one', 2)).toBe('Only one');
  });
});

describe('buildDailyTextBlocks', () => {
  it('gives a child one short unlabeled excerpt of the stored text', () => {
    expect(buildDailyTextBlocks(base, 'child', 'kg')).toEqual([{ labelKey: null, text: 'First sentence. Second sentence.', lang: 'kg' }]);
  });

  it('prefers the pre-authored simple summary in the current language', () => {
    const item = { ...base, simple_summary_en: 'Simple English summary.' } as CultureItemRow;
    expect(buildDailyTextBlocks(item, 'child', 'en')).toEqual([{ labelKey: null, text: 'Simple English summary.', lang: 'en' }]);
    // no Kyrgyz summary stored -> falls back to the excerpt, never a translation
    expect(buildDailyTextBlocks(item, 'child', 'kg')[0].text).toBe('First sentence. Second sentence.');
  });

  it('gives teens two labeled fields and adults up to four', () => {
    expect(buildDailyTextBlocks(base, 'teen', 'kg').map((block) => block.labelKey)).toEqual([
      'culture.item.culturalMeaningLabel',
      'culture.item.historyLabel',
    ]);
    expect(buildDailyTextBlocks(base, 'adult', 'kg')).toHaveLength(3);
  });

  it('only includes a challenge for younger experiences', () => {
    expect(dailyHasChallenge('child')).toBe(true);
    expect(dailyHasChallenge('teen')).toBe(true);
    expect(dailyHasChallenge('adult')).toBe(false);
  });
});
