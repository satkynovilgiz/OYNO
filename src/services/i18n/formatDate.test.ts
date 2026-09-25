import { formatLongDate, formatMonthYear, formatShortDate } from './formatDate';

describe('formatDate', () => {
  it('writes Kyrgyz dates with Kyrgyz month names, never an English fallback', () => {
    expect(formatLongDate('2026-09-21', 'kg')).toBe('21-сентябрь, 2026');
    expect(formatShortDate('2026-09-25', 'kg')).toBe('25-сен.');
    expect(formatMonthYear('2026-08', 'kg')).toBe('АВГУСТ 2026');
  });

  it('uses Intl for Russian and English', () => {
    expect(formatLongDate('2026-09-21', 'en')).toBe('September 21, 2026');
    expect(formatShortDate('2026-09-25', 'en')).toBe('Sep 25');
    expect(formatMonthYear('2026-09', 'en')).toBe('SEPTEMBER 2026');
  });

  it('returns the raw key for malformed input', () => {
    expect(formatLongDate('not-a-date', 'kg')).toBe('not-a-date');
    expect(formatMonthYear('x', 'ru')).toBe('x');
  });
});
