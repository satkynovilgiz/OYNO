import type { SupportedLanguage } from '@/i18n';

const LOCALE_BY_LANGUAGE: Record<SupportedLanguage, string> = { kg: 'ky-KG', ru: 'ru-RU', en: 'en-US' };

/** "22 Sep" / "22 сент." for a local YYYY-MM-DD key - shared by the Daily
 * hero and Journey's daily-discovery stamps so both read the same date the
 * same way. Falls back to the raw key if the runtime lacks that locale. */
export function formatDayLabel(dateKey: string, language: SupportedLanguage): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  try {
    return new Date(y, m - 1, d).toLocaleDateString(LOCALE_BY_LANGUAGE[language] ?? 'en-US', { day: 'numeric', month: 'short' });
  } catch {
    return dateKey;
  }
}
