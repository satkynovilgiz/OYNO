/**
 * Localized game measurements - "12.5 m" / "12,5 м" / "12,5 м" - instead of
 * hardcoded English unit suffixes. RU and KG write decimals with a comma.
 * Deterministic (no Intl dependency, so identical on Hermes, web and Jest).
 */
export type GameUnit = 'seconds' | 'meters' | 'metersPerSecond';

type Translate = (key: string, options?: Record<string, unknown>) => string;

export function formatGameNumber(value: number, digits: number, language: string): string {
  const fixed = (Number.isFinite(value) ? value : 0).toFixed(digits);
  return language === 'en' ? fixed : fixed.replace('.', ',');
}

export function formatGameUnit(t: Translate, language: string, unit: GameUnit, value: number, digits = 1): string {
  return t(`games3d.units.${unit}`, { value: formatGameNumber(value, digits, language) });
}
