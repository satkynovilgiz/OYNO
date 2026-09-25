import type { SupportedLanguage } from '@/i18n';
import { formatShortDate } from '@/services/i18n/formatDate';

/** "22 Sep" / "22 сент." / "22-сен." for a local YYYY-MM-DD key - shared
 * by the Daily hero, the Challenges hub and Journey's daily stamps. */
export function formatDayLabel(dateKey: string, language: SupportedLanguage): string {
  return formatShortDate(dateKey, language);
}
