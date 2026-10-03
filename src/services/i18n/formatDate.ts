import type { SupportedLanguage } from '@/i18n';

/**
 * Local-calendar date labels that don't depend on the JS engine's locale
 * data. Hermes and many browsers ship no Kyrgyz (`ky`) locale, so
 * `toLocaleDateString('ky-KG')` silently falls back to English
 * ("September 21, 2026" on a Kyrgyz screen). Kyrgyz uses explicit month
 * names here; RU/EN use Intl, which every runtime supports.
 */
const KG_MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const KG_MONTHS_SHORT = ['янв.', 'фев.', 'мар.', 'апр.', 'май', 'июн.', 'июл.', 'авг.', 'сен.', 'окт.', 'ноя.', 'дек.'];
const LOCALE: Record<Exclude<SupportedLanguage, 'kg'>, string> = { ru: 'ru-RU', en: 'en-US' };

function parts(dateKey: string): [number, number, number] | null {
  const [y, m, d] = dateKey.split('-').map(Number);
  return y && m && d ? [y, m, d] : null;
}

/** "21-сентябрь, 2026" / "21 сентября 2026 г." / "September 21, 2026". */
export function formatLongDate(dateKey: string, language: SupportedLanguage): string {
  const p = parts(dateKey);
  if (!p) return dateKey;
  const [y, m, d] = p;
  if (language === 'kg') return `${d}-${KG_MONTHS[m - 1]}, ${y}`;
  try {
    return new Date(y, m - 1, d).toLocaleDateString(LOCALE[language], { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return dateKey;
  }
}

/** "21-сен." / "21 сент." / "Sep 21". */
export function formatShortDate(dateKey: string, language: SupportedLanguage): string {
  const p = parts(dateKey);
  if (!p) return dateKey;
  const [y, m, d] = p;
  if (language === 'kg') return `${d}-${KG_MONTHS_SHORT[m - 1]}`;
  try {
    return new Date(y, m - 1, d).toLocaleDateString(LOCALE[language], { day: 'numeric', month: 'short' });
  } catch {
    return dateKey;
  }
}

/** Month heading for a YYYY-MM key: "СЕНТЯБРЬ 2026" / "СЕНТЯБРЬ 2026 Г." / "SEPTEMBER 2026". */
export function formatMonthYear(month: string, language: SupportedLanguage): string {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m) return month;
  if (language === 'kg') return `${KG_MONTHS[m - 1]} ${y}`.toUpperCase();
  try {
    return new Date(y, m - 1, 1).toLocaleDateString(LOCALE[language], { month: 'long', year: 'numeric' }).toUpperCase();
  } catch {
    return month;
  }
}

/** Local YYYY-MM-DD of an ISO timestamp (null when it isn't a real time). */
export function localDateKeyOf(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local clock time: "15:42" (KG/RU), "3:42 PM" (EN). */
export function formatTime(iso: string, language: SupportedLanguage): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  if (language === 'en') {
    try {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } catch {
      // fall through to 24h
    }
  }
  return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** "21-сен. · 15:42" / "21 сент. · 15:42" / "Sep 21 · 3:42 PM". */
export function formatDateTime(iso: string, language: string): string {
  const lang = (language === 'ru' || language === 'en' ? language : 'kg') as SupportedLanguage;
  const key = localDateKeyOf(iso);
  return key ? `${formatShortDate(key, lang)} · ${formatTime(iso, lang)}` : '';
}
