import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';

import { SaveStatus, useSaveFeedback } from '@/components/feedback/SaveStatus';
import { LoadingState, StateMessage } from '@/components/state/ScreenState';
import { Button, ConfirmationModal, IconButton } from '@/components/ui';
import { SettingsScreenLayout } from '@/features/settings/components/SettingsScreenLayout';
import { useRecordsOwner } from '@/features/games/records/useGameRecords';
import { ownerShortcuts, useHomeShortcutsStore } from '@/store/useHomeShortcutsStore';
import { cards, colors, headings, spacing, text } from '@/theme';

import { INTERESTS, type Activity } from '../chooser/activityChooser';
import { isDefault, MAX_PINS, pinnable, pinsOf, resolvePins, type PinChange } from './shortcutsModel';

/**
 * /settings/home-shortcuts - choose up to four Home shortcuts from the
 * activity catalogue, move them up/down (buttons, so keyboards and screen
 * readers can reorder), remove, and Reset (with confirmation) to the
 * default four. Every change is written first; a failed write leaves the
 * shortcuts as they were and says so.
 */
export function HomeShortcutsScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const owner = useRecordsOwner();
  const status = useHomeShortcutsStore((state) => state.status);
  const saved = useHomeShortcutsStore((state) => state.saved);
  // Saving / Saved / Not saved, from the write's real result (one confirmation haptic, never on the tap).
  const feedback = useSaveFeedback();
  const busy = feedback.saving;
  const [stale, setStale] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const shownOwner = useRef(owner);
  useEffect(() => {
    void useHomeShortcutsStore.getState().load();
  }, []);
  useEffect(() => {
    shownOwner.current = owner;
    setStale(false);
    setConfirmReset(false);
  }, [owner]);

  const stored = ownerShortcuts(saved, owner);
  const pins = pinsOf(stored);
  const { shown, unavailableIds } = resolvePins(pins, () => true);
  const titleOf = (activity: Activity) => activity.title ?? t(activity.titleKey!);

  async function apply(change: PinChange, announce?: string) {
    if (busy) return;
    const startedFor = owner;
    setStale(false);
    const ok = await feedback.run(() => useHomeShortcutsStore.getState().change(startedFor, change));
    // A result for an account that's no longer shown is never applied to this one's screen.
    if (shownOwner.current !== startedFor) return setStale(true);
    if (ok && announce) AccessibilityInfo.announceForAccessibility(announce);
  }

  let body: React.ReactNode;
  if (status === 'error') body = <StateMessage kind="error" title={t('homeShortcuts.loadError')} body={t('states.recordsErrorBody')} action={{ label: t('common.retry'), onPress: () => void useHomeShortcutsStore.getState().retryLoad(), testID: 'shortcuts-retry' }} />;
  else if (status !== 'ready') body = <LoadingState label={t('homeShortcuts.loading')} onRetry={() => void useHomeShortcutsStore.getState().retryLoad()} />;
  else {
    const full = pins.length >= MAX_PINS;
    body = (
      <View style={styles.stack}>
        <Text style={styles.intro}>{t('homeShortcuts.intro', { max: MAX_PINS })}</Text>
        <Text style={styles.section} accessibilityRole="header">
          {t('homeShortcuts.pinned', { count: pins.length, max: MAX_PINS })}
        </Text>
        <View style={styles.list} testID="shortcuts-pinned">
          {shown.map(({ activity }, index) => (
            <View key={activity.id} style={styles.row} testID={`shortcut-pinned-${activity.id}`}>
              <Text style={[styles.rowTitle, styles.flex]}>
                {index + 1}. {titleOf(activity)}
              </Text>
              <IconButton icon={ChevronUp} size={40} elevated={false} disabled={index === 0} keepFocusWhenDisabled accessibilityLabel={t('homeShortcuts.moveUp', { name: titleOf(activity) })} onPress={() => void apply({ type: 'move', id: activity.id, delta: -1 }, t('homeShortcuts.moved', { name: titleOf(activity), position: index }))} testID={`shortcut-up-${activity.id}`} />
              <IconButton icon={ChevronDown} size={40} elevated={false} disabled={index === shown.length - 1} keepFocusWhenDisabled accessibilityLabel={t('homeShortcuts.moveDown', { name: titleOf(activity) })} onPress={() => void apply({ type: 'move', id: activity.id, delta: 1 }, t('homeShortcuts.moved', { name: titleOf(activity), position: index + 2 }))} testID={`shortcut-down-${activity.id}`} />
              <IconButton icon={X} size={40} elevated={false} accessibilityLabel={t('homeShortcuts.remove', { name: titleOf(activity) })} onPress={() => void apply({ type: 'remove', id: activity.id }, t('homeShortcuts.removed', { name: titleOf(activity) }))} testID={`shortcut-remove-${activity.id}`} />
            </View>
          ))}
          {shown.length === 0 ? <Text style={styles.meta}>{t('homeShortcuts.none')}</Text> : null}
        </View>
        {unavailableIds.length > 0 ? (
          <View style={styles.note} testID="shortcuts-unavailable">
            <Text style={styles.body}>{t('homeShortcuts.unavailable', { count: unavailableIds.length })}</Text>
            <Button label={t('homeShortcuts.removeUnavailable')} variant="secondary" size="sm" disabled={busy} onPress={() => void apply({ type: 'removeUnavailable' })} testID="shortcuts-remove-unavailable" />
          </View>
        ) : null}
        {stale ? null : <SaveStatus state={feedback.state} failedLabel={t('homeShortcuts.saveFailed')} testID="shortcuts" />}

        <Text style={styles.section} accessibilityRole="header">
          {t('homeShortcuts.add')}
        </Text>
        {full ? <Text style={styles.meta}>{t('homeShortcuts.full', { max: MAX_PINS })}</Text> : null}
        {INTERESTS.map((interest) => {
          const options = pinnable(pins).filter((activity) => activity.interest === interest);
          if (options.length === 0) return null;
          return (
            <View key={interest} style={styles.group}>
              <Text style={styles.groupLabel}>{t(`activityChooser.interests.${interest}`)}</Text>
              {options.map((activity) => (
                <View key={activity.id} style={styles.row}>
                  <Text style={[styles.body, styles.flex]}>{titleOf(activity)}</Text>
                  <IconButton icon={Plus} size={40} elevated={false} disabled={full} accessibilityLabel={t('homeShortcuts.addOne', { name: titleOf(activity) })} onPress={() => void apply({ type: 'add', id: activity.id }, t('homeShortcuts.added', { name: titleOf(activity) }))} testID={`shortcut-add-${activity.id}`} />
                </View>
              ))}
            </View>
          );
        })}

        <Button label={t('homeShortcuts.reset')} variant="secondary" disabled={busy || isDefault(stored)} onPress={() => setConfirmReset(true)} testID="shortcuts-reset" />
        <Text style={styles.meta}>{isDefault(stored) ? t('homeShortcuts.isDefault') : t('homeShortcuts.separate')}</Text>
      </View>
    );
  }

  return (
    <SettingsScreenLayout title={t('homeShortcuts.screenTitle')} onPressBack={onPressBack}>
      <View testID="home-shortcuts-screen">{body}</View>
      <ConfirmationModal
        visible={confirmReset}
        title={t('homeShortcuts.resetTitle')}
        message={t('homeShortcuts.resetMessage')}
        confirmLabel={t('homeShortcuts.resetConfirm')}
        cancelLabel={t('common.cancel')}
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          setConfirmReset(false);
          void apply({ type: 'reset' }, t('homeShortcuts.resetDone'));
        }}
      />
    </SettingsScreenLayout>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.sm },
  intro: { ...text.body, color: colors.textSecondary },
  section: { ...headings.label, color: colors.textSecondary, marginTop: spacing.sm },
  list: { ...cards.standard, gap: 0, paddingVertical: spacing.xxs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs, minHeight: 48 },
  flex: { flex: 1 },
  rowTitle: { ...text.emphasis, fontWeight: '700', color: colors.textPrimary },
  body: { ...text.body, color: colors.textPrimary },
  meta: { ...text.meta, color: colors.textSecondary },
  warn: { ...text.meta, fontWeight: '700', color: colors.dangerText },
  note: { ...cards.note, gap: spacing.xs },
  group: { ...cards.compact, gap: 0 },
  groupLabel: { ...text.fine, color: colors.accentTerracottaText, paddingTop: spacing.xxs },
});
