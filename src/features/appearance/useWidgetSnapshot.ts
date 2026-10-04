import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { calendarList, CULTURAL_CALENDAR, homeEvent, isToday } from '@/features/culture/calendar/culturalCalendar';
import { formatOccurrence } from '@/features/culture/calendar/CulturalCalendarScreen';
import { useTodayDiscovery } from '@/features/daily/useTodayDiscovery';
import { LEARNING_PATHS } from '@/features/learn/learningPaths';
import { useWhatsNew } from '@/features/whatsNew/useWhatsNew';
import type { SupportedLanguage } from '@/i18n';
import { localDateKey } from '@/services/daily/dailyDiscovery';
import { buildPublicWidgetSnapshot, type PublicWidgetSnapshot } from '@/services/widgets/publicWidgetSnapshot';

/** The curated beginner path - static, never progress-based. */
const BEGINNER_PATH_ID = 'boz-uy';

/**
 * The "Today in OYNO" widget snapshot from PUBLIC content only: the same
 * Cultural Calendar rule Home uses (3-day window), today's Daily OYNO item,
 * the newest What's New story and the curated beginner path. Nothing about
 * the user (progress, Journal, account) is read here.
 */
export function useWidgetSnapshot(): PublicWidgetSnapshot {
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const { discovery } = useTodayDiscovery();
  const { items: whatsNew } = useWhatsNew();
  const dailyId = discovery?.item.id ?? null;
  const dailyTitle = discovery?.item.title ?? null;
  const dailyMinutes = discovery?.minutes ?? null;
  const latest = whatsNew[0] ?? null;
  const today = localDateKey(new Date());

  return useMemo(() => {
    const now = new Date();
    const entry = homeEvent(calendarList(CULTURAL_CALENDAR, now), now);
    const path = LEARNING_PATHS.find((candidate) => candidate.id === BEGINNER_PATH_ID) ?? null;
    return buildPublicWidgetSnapshot({
      language,
      now,
      localDate: today,
      labels: { brand: 'OYNO', open: t('widget.open'), fallbackTitle: t('widget.fallbackTitle'), fallbackSubtitle: t('widget.fallbackSubtitle') },
      calendar: entry
        ? { id: entry.event.id, title: t(entry.event.titleKey), dateText: formatOccurrence(entry.occurrence, language, ''), isToday: isToday(entry.occurrence, now), eyebrowToday: t('widget.eyebrow.calendarToday'), eyebrowSoon: t('widget.eyebrow.calendarSoon') }
        : null,
      daily: dailyId && dailyTitle ? { itemId: dailyId, title: dailyTitle, eyebrow: t('widget.eyebrow.daily'), subtitle: dailyMinutes ? t('daily.minutes', { count: dailyMinutes }) : null } : null,
      whatsNew: latest ? { type: latest.type, id: latest.id, title: latest.title, eyebrow: t('widget.eyebrow.whatsNew') } : null,
      path: path ? { id: path.id, title: t(path.titleKey), eyebrow: t('widget.eyebrow.path') } : null,
    });
    // `today` re-evaluates the calendar window at midnight.
  }, [t, language, today, dailyId, dailyTitle, dailyMinutes, latest]);
}
