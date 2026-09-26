import { formatGameNumber, formatGameUnit } from './gameUnits';

const t = (key: string, options?: Record<string, unknown>) => `${key}|${String(options?.value)}`;

describe('game units', () => {
  it('uses a decimal comma for RU/KG and a point for EN', () => {
    expect(formatGameNumber(12.46, 1, 'en')).toBe('12.5');
    expect(formatGameNumber(12.46, 1, 'ru')).toBe('12,5');
    expect(formatGameNumber(12.46, 1, 'kg')).toBe('12,5');
    expect(formatGameNumber(7, 0, 'ru')).toBe('7');
  });

  it('never prints NaN/Infinity', () => {
    expect(formatGameNumber(Number.POSITIVE_INFINITY, 1, 'en')).toBe('0.0');
  });

  it('routes the unit through a translation key', () => {
    expect(formatGameUnit(t, 'ru', 'metersPerSecond', 9.25)).toBe('games3d.units.metersPerSecond|9,3');
  });
});
