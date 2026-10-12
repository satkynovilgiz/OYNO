import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button, TextField } from '@/components/ui';
import { announce } from '@/services/a11y/announce';
import { ownerMilestones, useOymoMilestonesStore } from '@/store/useOymoMilestonesStore';
import { colors, spacing, textStyles } from '@/theme';

import { LABEL_MAX, MAX_PER_DESIGN, milestonesRoute, newMilestoneId, type Snapshot } from './milestonesModel';

/**
 * In the Creator, for a design opened from a saved creation: "Save a
 * milestone" takes a snapshot AT THE TAP (later edits don't change it) and
 * says "saved" only after the write succeeded. The label typed while a save
 * is pending is kept.
 */
export function MilestoneBar({ owner, creationId, snapshot }: { owner: string; creationId: string; snapshot: () => Snapshot }) {
  const { t } = useTranslation();
  const status = useOymoMilestonesStore((state) => state.status);
  const count = ownerMilestones(useOymoMilestonesStore((state) => state.saved), owner)[creationId]?.length ?? 0;
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<'saved' | 'failed' | 'limit' | 'size' | null>(null);
  const labelRef = useRef(label);
  const shownOwner = useRef(owner);
  useEffect(() => {
    void useOymoMilestonesStore.getState().load();
  }, []);
  useEffect(() => {
    shownOwner.current = owner;
    setOpen(false);
    setLabel('');
    setMessage(null);
  }, [owner, creationId]);
  const edit = (value: string) => {
    const next = value.slice(0, LABEL_MAX);
    labelRef.current = next;
    setLabel(next);
  };
  const save = async () => {
    const startedFor = owner;
    const sent = label;
    const taken = snapshot(); // the design as it is NOW
    setBusy(true);
    const outcome = await useOymoMilestonesStore.getState().add(startedFor, creationId, taken, sent, newMilestoneId());
    setBusy(false);
    if (shownOwner.current !== startedFor) return;
    setMessage(outcome);
    announce(t(`milestones.result.${outcome}`, { max: MAX_PER_DESIGN }));
    if (outcome !== 'saved') return; // the label stays for Retry
    if (labelRef.current === sent) {
      setLabel('');
      labelRef.current = '';
      setOpen(false);
    }
  };

  return (
    <View style={styles.wrap} testID="milestone-bar">
      {open ? (
        <View style={styles.stack}>
          <TextField label={t('milestones.labelField')} value={label} onChangeText={edit} placeholder={t('milestones.labelPlaceholder')} testID="milestone-label" />
          <View style={styles.row}>
            <Button label={message === 'failed' ? t('common.retry') : t('milestones.save')} size="sm" loading={busy} disabled={status !== 'ready' || count >= MAX_PER_DESIGN} onPress={save} testID="milestone-save" />
            <Button label={t('common.cancel')} variant="text" size="sm" disabled={busy} onPress={() => setOpen(false)} />
          </View>
        </View>
      ) : (
        <Button label={t('milestones.saveA')} variant="secondary" disabled={status !== 'ready'} onPress={() => setOpen(true)} accessibilityHint={t('milestones.saveHint')} testID="milestone-open" />
      )}
      {message ? (
        <Text style={message === 'saved' ? styles.meta : styles.warn} accessibilityLiveRegion="polite" testID={`milestone-result-${message}`}>
          {t(`milestones.result.${message}`, { max: MAX_PER_DESIGN })}
        </Text>
      ) : null}
      {count > 0 ? <Button label={t('milestones.gallery', { count })} variant="text" size="sm" onPress={() => router.push(milestonesRoute(creationId) as never)} testID="milestone-gallery" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  stack: { gap: spacing.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  meta: { ...textStyles.small, color: colors.textSecondary },
  warn: { ...textStyles.small, fontWeight: '700', color: colors.accentTerracottaText },
});
