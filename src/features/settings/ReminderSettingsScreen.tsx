import * as Haptics from 'expo-haptics';
import { BellOff, CalendarDays, ChevronRight, Clock, Moon, Route, Sparkles, type LucideIcon } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, FlatList, Linking, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button, Toggle } from '@/components/ui';
import { track } from '@/services/analytics/analytics';
import { useReducedMotion } from '@/services/motion/useReducedMotion';
import { registerForPushNotifications } from '@/services/notifications/pushRegistration';
import type { ReminderSettings, ReminderType } from '@/services/reminders/reminderPlanner';
import { getReminderPermission, requestReminderPermission, type ReminderPermission } from '@/services/reminders/reminderScheduler';
import { useAuthStore } from '@/store/useAuthStore';
import { useReminderSettingsStore } from '@/store/useReminderSettingsStore';
import { cardRadii, colors, elevation, radii, spacing, textStyles } from '@/theme';

import { SettingsScreenLayout } from './components/SettingsScreenLayout';

const SLOT_MINUTES = 15;
const DAY_MINUTES = 24 * 60;
const SLOTS = Array.from({ length: DAY_MINUTES / SLOT_MINUTES }, (_, index) => index * SLOT_MINUTES);
const SLOT_HEIGHT = 48;

export function formatTime(minutes: number): string {
  const normalized = ((minutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
}

const TOGGLE_KEY: Record<ReminderType, keyof ReminderSettings> = {
  daily: 'dailyEnabled',
  journey: 'journeyEnabled',
  trail: 'trailEnabled',
};

type TimeTarget = 'time' | 'quietStart' | 'quietEnd';

/**
 * Settings -> Reminders. Every reminder is off until the user turns it on;
 * notification permission is requested only at that moment (never at
 * launch) and never again after the user said no - then the screen shows a
 * calm "off in Settings" status with Open Settings. Local notifications
 * only (device timezone), at most one a day, no marketing push.
 */
export function ReminderSettingsScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const settings = useReminderSettingsStore((state) => state.settings);
  const [permission, setPermission] = useState<ReminderPermission>('undetermined');
  const [timeTarget, setTimeTarget] = useState<TimeTarget | null>(null);

  const refreshPermission = useCallback(() => void getReminderPermission().then(setPermission), []);

  useEffect(() => {
    if (!useReminderSettingsStore.getState().isLoaded) void useReminderSettingsStore.getState().load();
    refreshPermission();
    // Coming back from iOS Settings: pick up a changed permission.
    const subscription = AppState.addEventListener('change', (state) => state === 'active' && refreshPermission());
    return () => subscription.remove();
  }, [refreshPermission]);

  const unavailable = permission === 'unavailable';
  const denied = permission === 'denied';

  async function setEnabled(type: ReminderType, value: boolean) {
    const key = TOGGLE_KEY[type];
    if (Platform.OS !== 'web') void Haptics.selectionAsync().catch(() => {});
    if (!value) {
      await useReminderSettingsStore.getState().update({ [key]: false });
      track('reminder_disabled', { type });
      return;
    }
    const granted = await requestReminderPermission();
    refreshPermission();
    // Refused: the toggle stays honestly off.
    if (!granted) return;
    await useReminderSettingsStore.getState().update({ [key]: true });
    track('reminder_enabled', { type });
    // Now that the user granted it, keep a signed-in device's push token too.
    if (useAuthStore.getState().status === 'authenticated') void registerForPushNotifications();
  }

  const update = (patch: Partial<ReminderSettings>) => void useReminderSettingsStore.getState().update(patch);

  const rows: { type: ReminderType; icon: LucideIcon; label: string; hint: string }[] = [
    { type: 'daily', icon: Sparkles, label: t('reminders.daily'), hint: t('reminders.dailyHint') },
    { type: 'journey', icon: CalendarDays, label: t('reminders.journey'), hint: t('reminders.journeyHint') },
    { type: 'trail', icon: Route, label: t('reminders.trail'), hint: t('reminders.trailHint') },
  ];
  const anyOn = settings.dailyEnabled || settings.journeyEnabled || settings.trailEnabled;

  const pickerValue = timeTarget === 'quietStart' ? settings.quietHours.start : timeTarget === 'quietEnd' ? settings.quietHours.end : settings.time;
  function applyTime(minutes: number) {
    if (timeTarget === 'time') update({ time: minutes });
    if (timeTarget === 'quietStart') update({ quietHours: { ...settings.quietHours, start: minutes } });
    if (timeTarget === 'quietEnd') update({ quietHours: { ...settings.quietHours, end: minutes } });
    setTimeTarget(null);
  }

  return (
    <SettingsScreenLayout title={t('reminders.title')} onPressBack={onPressBack}>
      {unavailable ? <Text style={styles.status}>{t('reminders.phoneOnly')}</Text> : null}
      {denied ? (
        <View style={styles.offCard}>
          <BellOff size={20} color={colors.textSecondary} strokeWidth={2} />
          <View style={styles.offText}>
            <Text style={styles.offTitle}>{t('reminders.v2.offTitle')}</Text>
            <Text style={styles.offBody}>{t('reminders.v2.offBody')}</Text>
            <View style={styles.offAction}>
              <Button label={t('reminders.v2.openSettings')} variant="secondary" size="sm" onPress={() => void Linking.openSettings().catch(() => {})} />
            </View>
          </View>
        </View>
      ) : null}

      <View style={styles.group}>
        {rows.map(({ type, icon: Icon, label, hint }, index) => (
          <View key={type} style={[styles.row, index === rows.length - 1 && styles.rowLast]}>
            <View style={styles.icon}>
              <Icon size={18} color={colors.primary} strokeWidth={2} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.label}>{label}</Text>
              <Text style={styles.hint}>{hint}</Text>
            </View>
            <Toggle value={settings[TOGGLE_KEY[type]] as boolean} onValueChange={(value) => void setEnabled(type, value)} accessibilityLabel={label} disabled={unavailable || denied} />
          </View>
        ))}
      </View>
      <Text style={styles.footnote}>{permission === 'undetermined' && !anyOn ? `${t('reminders.v2.askNote')} ` : ''}{t('reminders.onePerDay')}</Text>

      <Text style={styles.sectionTitle}>{t('reminders.v2.whenTitle')}</Text>
      <View style={styles.group}>
        <TimeRow icon={Clock} label={t('reminders.time')} minutes={settings.time} onPress={() => setTimeTarget('time')} />
        <View style={[styles.row, !settings.quietHours.enabled && styles.rowLast]}>
          <View style={styles.icon}>
            <Moon size={18} color={colors.primary} strokeWidth={2} />
          </View>
          <View style={styles.rowText}>
            <Text style={styles.label}>{t('reminders.quietHours')}</Text>
            <Text style={styles.hint}>{t('reminders.quietHint')}</Text>
          </View>
          <Toggle value={settings.quietHours.enabled} onValueChange={(enabled) => update({ quietHours: { ...settings.quietHours, enabled } })} accessibilityLabel={t('reminders.quietHours')} />
        </View>
        {settings.quietHours.enabled ? (
          <>
            <TimeRow label={t('reminders.quietFrom')} minutes={settings.quietHours.start} onPress={() => setTimeTarget('quietStart')} indent />
            <TimeRow label={t('reminders.quietTo')} minutes={settings.quietHours.end} onPress={() => setTimeTarget('quietEnd')} indent last />
          </>
        ) : null}
      </View>

      {timeTarget ? <TimeSheet title={timeTarget === 'time' ? t('reminders.v2.pickTime') : timeTarget === 'quietStart' ? t('reminders.quietFrom') : t('reminders.quietTo')} value={pickerValue} onPick={applyTime} onClose={() => setTimeTarget(null)} /> : null}
    </SettingsScreenLayout>
  );
}

/** Compact "Label ........ 19:00 ›" row that opens the time sheet. */
function TimeRow({ icon: Icon, label, minutes, onPress, indent = false, last = false }: { icon?: LucideIcon; label: string; minutes: number; onPress: () => void; indent?: boolean; last?: boolean }) {
  return (
    <AnimatedPressable style={[styles.row, last && styles.rowLast]} onPress={onPress} press="soft" accessibilityRole="button" accessibilityLabel={`${label}, ${formatTime(minutes)}`}>
      {Icon ? (
        <View style={styles.icon}>
          <Icon size={18} color={colors.primary} strokeWidth={2} />
        </View>
      ) : (
        <View style={indent ? styles.indent : undefined} />
      )}
      <Text style={[styles.label, styles.rowText]}>{label}</Text>
      <Text style={styles.time}>{formatTime(minutes)}</Text>
      <ChevronRight size={16} color={colors.textMuted} strokeWidth={2} />
    </AnimatedPressable>
  );
}

/** Bottom sheet with 15-minute slots (no extra native picker dependency). */
function TimeSheet({ title, value, onPick, onClose }: { title: string; value: number; onPick: (minutes: number) => void; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const selectedIndex = Math.max(0, SLOTS.indexOf(value - (value % SLOT_MINUTES)));
  return (
    <Modal visible transparent animationType={reducedMotion ? 'none' : 'slide'} onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel={title} />
      <View style={[styles.sheet, elevation.floating, { paddingBottom: insets.bottom + spacing.sm }]} accessibilityViewIsModal>
        <View style={styles.handle} />
        <Text style={styles.sheetTitle} accessibilityRole="header">
          {title}
        </Text>
        <FlatList
          data={SLOTS}
          keyExtractor={(slot) => String(slot)}
          initialScrollIndex={Math.max(0, selectedIndex - 2)}
          getItemLayout={(_, index) => ({ length: SLOT_HEIGHT, offset: SLOT_HEIGHT * index, index })}
          renderItem={({ item }) => {
            const selected = item === SLOTS[selectedIndex];
            return (
              <AnimatedPressable
                style={[styles.slot, selected && styles.slotSelected]}
                onPress={() => onPick(item)}
                press="strong"
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={formatTime(item)}
              >
                <Text style={[styles.slotText, selected && styles.slotTextSelected]}>{formatTime(item)}</Text>
              </AnimatedPressable>
            );
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  status: { ...textStyles.caption, color: colors.textSecondary, marginBottom: spacing.sm },
  offCard: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, marginBottom: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceMuted },
  offText: { flex: 1, gap: 4 },
  offTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  offBody: { ...textStyles.caption, color: colors.textSecondary },
  offAction: { flexDirection: 'row', marginTop: spacing.xs },
  group: { backgroundColor: colors.surfaceElevated, borderRadius: cardRadii.compact, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 60, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth * 2, borderBottomColor: colors.borderSubtle },
  rowLast: { borderBottomWidth: 0 },
  icon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
  indent: { width: 34 },
  rowText: { flex: 1, gap: 2 },
  label: { ...textStyles.bodyMedium, color: colors.textPrimary, flexShrink: 1 },
  hint: { ...textStyles.caption, color: colors.textMuted },
  time: { ...textStyles.title, fontSize: 16, color: colors.primary, fontVariant: ['tabular-nums'] },
  footnote: { ...textStyles.caption, color: colors.textMuted, marginTop: spacing.xs, marginHorizontal: spacing.xxs },
  sectionTitle: { ...textStyles.overline, color: colors.textSecondary, marginTop: spacing.xl, marginBottom: spacing.xs, marginHorizontal: spacing.xxs },
  backdrop: { flex: 1, backgroundColor: 'rgba(19,32,24,0.5)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%', paddingTop: spacing.xs, paddingHorizontal: spacing.md, gap: spacing.sm, borderTopLeftRadius: cardRadii.hero, borderTopRightRadius: cardRadii.hero, backgroundColor: colors.background },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderSubtle },
  sheetTitle: { ...textStyles.title, color: colors.textPrimary, textAlign: 'center' },
  slot: { height: SLOT_HEIGHT, alignItems: 'center', justifyContent: 'center', borderRadius: radii.lg },
  slotSelected: { backgroundColor: colors.primary },
  slotText: { ...textStyles.h3, color: colors.textPrimary, fontVariant: ['tabular-nums'] },
  slotTextSelected: { color: colors.textOnDark },
});
