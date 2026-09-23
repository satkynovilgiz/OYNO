import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState } from 'react-native';

import { useTodayDiscovery } from '@/features/daily/useTodayDiscovery';
import { useHomeRecommendation } from '@/features/home/useHomeRecommendation';
import { computeTrailProgress } from '@/features/trails/trailProgress';
import { trails } from '@/features/trails/trailsData';
import { useTrailSignals } from '@/features/trails/useTrailSignals';
import type { SupportedLanguage } from '@/i18n';
import { track } from '@/services/analytics/analytics';
import { planReminders } from '@/services/reminders/reminderPlanner';
import { syncReminderSchedule } from '@/services/reminders/reminderScheduler';
import { useReminderSettingsStore } from '@/store/useReminderSettingsStore';

const SYNC_DEBOUNCE_MS = 1000;

/**
 * Keeps OYNO's local reminders in line with the user's settings and real
 * state (native only; mounted once in the root layout). Re-plans when the
 * settings, today's Daily completion, the Home recommendation, the active
 * trail or the app language change, and when the app returns to the
 * foreground (days roll over). Also routes a tapped reminder to its screen.
 * Never requests notification permission.
 */
export function ReminderSync() {
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const settings = useReminderSettingsStore((state) => state.settings);
  const isLoaded = useReminderSettingsStore((state) => state.isLoaded);
  const { discovery } = useTodayDiscovery();
  const { recommendation, display } = useHomeRecommendation();
  const signals = useTrailSignals();
  const [foregroundTick, setForegroundTick] = useState(0);

  useEffect(() => {
    if (!useReminderSettingsStore.getState().isLoaded) void useReminderSettingsStore.getState().load();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setForegroundTick((tick) => tick + 1);
    });
    return () => subscription.remove();
  }, []);

  const activeTrail = useMemo(() => {
    for (const trail of trails) {
      const progress = computeTrailProgress(trail, signals);
      if (progress.status === 'inProgress') return { id: trail.id, title: trail.title[language] ?? trail.title.kg };
    }
    return null;
  }, [signals, language]);

  const continuation = recommendation.mode === 'continue' ? { route: recommendation.route, title: display.title } : null;

  useEffect(() => {
    if (!isLoaded) return;
    const timer = setTimeout(() => {
      const plan = planReminders(settings, {
        now: new Date(),
        language,
        dailyCompletedToday: !!discovery?.isCompleted,
        dailyCopy: { title: t('reminders.copy.dailyTitle'), body: t('reminders.copy.dailyBody') },
        journey: continuation
          ? { route: continuation.route, copy: { title: t('reminders.copy.journeyTitle'), body: t('reminders.copy.journeyBody', { title: continuation.title }) } }
          : null,
        trail: activeTrail
          ? { id: activeTrail.id, route: `/trails/${activeTrail.id}`, copy: { title: t('reminders.copy.trailTitle'), body: t('reminders.copy.trailBody', { title: activeTrail.title }) } }
          : null,
      });
      void syncReminderSchedule(plan);
    }, SYNC_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, settings, language, discovery?.isCompleted, continuation?.route, continuation?.title, activeTrail?.id, foregroundTick]);

  // Tapped reminder -> its real screen (also when the tap launched the app).
  useEffect(() => {
    const handled = new Set<string>();
    function open(response: Notifications.NotificationResponse | null) {
      const data = response?.notification.request.content.data;
      if (!response || data?.oynoReminder !== true || typeof data.route !== 'string') return;
      const id = response.notification.request.identifier;
      if (handled.has(id)) return;
      handled.add(id);
      track('reminder_opened', { type: String(data.type ?? '') });
      router.push(data.route as never);
    }
    open(Notifications.getLastNotificationResponse());
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    return () => subscription.remove();
  }, []);

  return null;
}
