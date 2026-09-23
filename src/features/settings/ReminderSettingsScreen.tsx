import { Minus, Plus } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable, Toggle } from '@/components/ui';
import { track } from '@/services/analytics/analytics';
import { registerForPushNotifications } from '@/services/notifications/pushRegistration';
import type { ReminderSettings, ReminderType } from '@/services/reminders/reminderPlanner';
import { requestReminderPermission } from '@/services/reminders/reminderScheduler';
import { useAuthStore } from '@/store/useAuthStore';
import { useReminderSettingsStore } from '@/store/useReminderSettingsStore';
import { colors, radii, spacing, typography } from '@/theme';

import { SettingsScreenLayout } from './components/SettingsScreenLayout';

const STEP_MINUTES = 15;
const DAY_MINUTES = 24 * 60;

function formatTime(minutes: number): string {
  const normalized = ((minutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
}

const TOGGLE_KEY: Record<ReminderType, keyof ReminderSettings> = {
  daily: 'dailyEnabled',
  journey: 'journeyEnabled',
  trail: 'trailEnabled',
};

/**
 * Settings -> Reminders. Every reminder is off until the user turns it on,
 * and notification permission is requested only at that moment (never at
 * launch). If the OS permission is refused, the toggle stays off and says
 * why. Local notifications only - no marketing push.
 */
export function ReminderSettingsScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const settings = useReminderSettingsStore((state) => state.settings);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const isWeb = Platform.OS === 'web';

  useEffect(() => {
    if (!useReminderSettingsStore.getState().isLoaded) void useReminderSettingsStore.getState().load();
  }, []);

  async function setEnabled(type: ReminderType, value: boolean) {
    const key = TOGGLE_KEY[type];
    if (!value) {
      await useReminderSettingsStore.getState().update({ [key]: false });
      track('reminder_disabled', { type });
      return;
    }
    const granted = await requestReminderPermission();
    setPermissionDenied(!granted);
    if (!granted) return;
    await useReminderSettingsStore.getState().update({ [key]: true });
    track('reminder_enabled', { type });
    // Now that the user granted it, keep a signed-in device's push token too.
    if (useAuthStore.getState().status === 'authenticated') void registerForPushNotifications();
  }

  const update = (patch: Partial<ReminderSettings>) => void useReminderSettingsStore.getState().update(patch);

  const rows: { type: ReminderType; label: string; hint: string }[] = [
    { type: 'daily', label: t('reminders.daily'), hint: t('reminders.dailyHint') },
    { type: 'journey', label: t('reminders.journey'), hint: t('reminders.journeyHint') },
    { type: 'trail', label: t('reminders.trail'), hint: t('reminders.trailHint') },
  ];

  return (
    <SettingsScreenLayout title={t('reminders.title')} onPressBack={onPressBack}>
      {isWeb ? <Text style={styles.notice}>{t('reminders.phoneOnly')}</Text> : null}
      {permissionDenied ? <Text style={styles.notice}>{t('reminders.permissionDenied')}</Text> : null}

      <View style={styles.group}>
        {rows.map(({ type, label, hint }, index) => (
          <View key={type} style={[styles.row, index === rows.length - 1 && styles.rowLast]}>
            <View style={styles.rowText}>
              <Text style={styles.label}>{label}</Text>
              <Text style={styles.hint}>{hint}</Text>
            </View>
            <Toggle value={settings[TOGGLE_KEY[type]] as boolean} onValueChange={(value) => void setEnabled(type, value)} accessibilityLabel={label} disabled={isWeb} />
          </View>
        ))}
      </View>
      <Text style={styles.footnote}>{t('reminders.onePerDay')}</Text>

      <Text style={styles.sectionTitle}>{t('reminders.time')}</Text>
      <View style={styles.group}>
        <TimeStepper label={t('reminders.time')} minutes={settings.time} onChange={(time) => update({ time })} />
      </View>

      <Text style={styles.sectionTitle}>{t('reminders.quietHours')}</Text>
      <View style={styles.group}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.label}>{t('reminders.quietHours')}</Text>
            <Text style={styles.hint}>{t('reminders.quietHint')}</Text>
          </View>
          <Toggle
            value={settings.quietHours.enabled}
            onValueChange={(enabled) => update({ quietHours: { ...settings.quietHours, enabled } })}
            accessibilityLabel={t('reminders.quietHours')}
          />
        </View>
        {settings.quietHours.enabled ? (
          <>
            <TimeStepper label={t('reminders.quietFrom')} minutes={settings.quietHours.start} onChange={(start) => update({ quietHours: { ...settings.quietHours, start } })} />
            <TimeStepper label={t('reminders.quietTo')} minutes={settings.quietHours.end} onChange={(end) => update({ quietHours: { ...settings.quietHours, end } })} last />
          </>
        ) : null}
      </View>
    </SettingsScreenLayout>
  );
}

/** Accessible -/+ time control in 15-minute steps (no extra native picker). */
function TimeStepper({ label, minutes, onChange, last = false }: { label: string; minutes: number; onChange: (value: number) => void; last?: boolean }) {
  const { t } = useTranslation();
  const change = (delta: number) => onChange((((minutes + delta) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES);
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.stepper} accessibilityRole="adjustable" accessibilityLabel={`${label}, ${formatTime(minutes)}`}>
        <AnimatedPressable style={styles.stepButton} onPress={() => change(-STEP_MINUTES)} accessibilityRole="button" accessibilityLabel={t('reminders.earlier', { label })}>
          <Minus size={16} color={colors.primary} strokeWidth={2.5} />
        </AnimatedPressable>
        <Text style={styles.time}>{formatTime(minutes)}</Text>
        <AnimatedPressable style={styles.stepButton} onPress={() => change(STEP_MINUTES)} accessibilityRole="button" accessibilityLabel={t('reminders.later', { label })}>
          <Plus size={16} color={colors.primary} strokeWidth={2.5} />
        </AnimatedPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { ...typography.caption, color: colors.accentTerracotta, marginBottom: spacing.sm },
  group: { backgroundColor: colors.surface, borderRadius: radii.lg, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceAlt,
  },
  rowLast: { borderBottomWidth: 0 },
  rowText: { flex: 1, gap: 2 },
  label: { ...typography.body, color: colors.textPrimary, flexShrink: 1 },
  hint: { ...typography.small, fontWeight: '500', color: colors.textMuted },
  footnote: { ...typography.small, fontWeight: '500', color: colors.textMuted, marginTop: spacing.xs },
  sectionTitle: { ...typography.overline, color: colors.textSecondary, marginTop: spacing.lg, marginBottom: spacing.xs },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  stepButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt },
  time: { ...typography.bodyBold, color: colors.textPrimary, minWidth: 52, textAlign: 'center' },
});
