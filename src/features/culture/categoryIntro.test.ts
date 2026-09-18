import { pickCategoryIntro } from './categoryIntro';
import type { CultureItemRow } from '@/services/content/types';

function makeItem(overrides: Partial<CultureItemRow>): CultureItemRow {
  return {
    id: 'x',
    category_id: 'boz-uy',
    subgroup: null,
    title: 'X',
    alt_names: null,
    type_label: null,
    origin: null,
    history: null,
    cultural_meaning: null,
    when_used: null,
    ingredients: null,
    traditional_method: null,
    who_participates: null,
    objects_used: null,
    regional_notes: null,
    modern_status: null,
    fun_facts: null,
    simple_summary_kg: null,
    simple_summary_ru: null,
    simple_summary_en: null,
    accuracy_level: 'partially_verified',
    sources: null,
    sort_order: 0,
    image_url: null,
    ...overrides,
  };
}

describe('pickCategoryIntro', () => {
  it('returns null when no item in the category has real content', () => {
    const items = [makeItem({ id: 'a' }), makeItem({ id: 'b' })];
    expect(pickCategoryIntro(items, 'kg', 'standard')).toBeNull();
  });

  it('picks the simple_summary for simple depth when one exists', () => {
    const items = [makeItem({ id: 'a', history: 'full history', simple_summary_kg: 'short version' })];
    expect(pickCategoryIntro(items, 'kg', 'simple')).toBe('short version');
  });

  it('falls back to history/cultural_meaning when no simple summary exists', () => {
    const items = [makeItem({ id: 'a', history: 'full history', cultural_meaning: 'meaning' })];
    expect(pickCategoryIntro(items, 'kg', 'simple')).toBe('full history meaning');
  });

  it('prefers the lowest sort_order item with real content', () => {
    const items = [
      makeItem({ id: 'b', sort_order: 5, history: 'later item' }),
      makeItem({ id: 'a', sort_order: 0, history: 'overview item' }),
    ];
    expect(pickCategoryIntro(items, 'kg', 'standard')).toBe('overview item');
  });

  it('never resolves an _ru/_en summary that is null (spec: never fake translations)', () => {
    const items = [makeItem({ id: 'a', history: 'full history', simple_summary_kg: 'kg only' })];
    expect(pickCategoryIntro(items, 'ru', 'simple')).toBe('full history');
  });
});
