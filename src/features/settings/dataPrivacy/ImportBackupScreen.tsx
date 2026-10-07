import { FileUp, Lock, ShieldCheck } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Switch, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { currentRecordsOwner, useRecordsOwner } from '@/features/games/records/useGameRecords';
import { track } from '@/services/analytics/analytics';
import { useTrackScreenView } from '@/services/analytics/useTrackScreenView';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { SettingsScreenLayout } from '../components/SettingsScreenLayout';
import { applyLearningImport, backupFingerprint, dismissPendingImport, previewLearningImport, readPendingImport, type DomainSummary, type ImportFailure, type ImportOutcome } from './applyLearningImport';
import { parseLearningBackup, type ImportError, type ParsedBackup } from './learningImport';
import { pickBackupFile } from './pickBackupFile';

type Phase =
  | { kind: 'idle' }
  | { kind: 'reading' }
  | { kind: 'error'; error: ImportError | 'unsupported' | 'failed' | 'owner_changed' | 'busy' | 'apply_partial' }
  | { kind: 'preview'; backup: ParsedBackup; owner: string; plan: DomainSummary[]; fingerprint: string }
  | { kind: 'applying'; backup: ParsedBackup }
  | { kind: 'done'; outcome: Extract<ImportOutcome, { ok: true }>; owner: string };

const FAILURE_PHASE: Record<ImportFailure, Extract<Phase, { kind: 'error' }>['error']> = { owner_changed: 'owner_changed', busy: 'busy', apply_partial: 'apply_partial', apply_failed: 'failed' };

/**
 * /settings/data-privacy/import - "Import OYNO backup". Choosing a file only
 * reads and checks it (nothing changes); the preview shows, per kind of
 * data, what importing WOULD add, update, leave as it is and keep - the
 * same plan the import then applies; only "Import and merge" changes data,
 * for the person who was signed in when they confirmed (or the guest).
 */
export function ImportBackupScreen({ onPressBack }: { onPressBack: () => void }) {
  useTrackScreenView('data_import');
  const { t } = useTranslation();
  const owner = useRecordsOwner();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [notesConfirmed, setNotesConfirmed] = useState(false);
  const [interrupted, setInterrupted] = useState(false);
  // Taps arrive faster than re-renders: one choose / one import at a time.
  const busy = useRef(false);

  useEffect(() => {
    let current = true;
    void readPendingImport(owner).then((pending) => current && setInterrupted(!!pending));
    return () => {
      current = false;
    };
  }, [owner, phase.kind]);

  // A preview (or result) belongs to the account it was made for.
  useEffect(() => {
    setPhase((current) => {
      if (current.kind === 'preview' && current.owner !== owner) return { kind: 'error', error: 'owner_changed' };
      if (current.kind === 'done' && current.owner !== owner) return { kind: 'idle' };
      return current;
    });
  }, [owner]);

  const choose = async () => {
    if (busy.current) return;
    busy.current = true;
    const startOwner = currentRecordsOwner();
    try {
      setPhase({ kind: 'reading' });
      setNotesConfirmed(false);
      const picked = await pickBackupFile();
      if (picked.status === 'canceled') return setPhase({ kind: 'idle' });
      if (picked.status !== 'picked') {
        track('data_import_failed', { schema_version: 0, domain_count: 0 });
        return setPhase({ kind: 'error', error: picked.status });
      }
      const parsed = parseLearningBackup(picked.text, picked.size);
      if (!parsed.ok) {
        track('data_import_failed', { schema_version: 0, domain_count: 0 });
        return setPhase({ kind: 'error', error: parsed.error });
      }
      // The account changed while the file was being read: it was chosen for someone else.
      if (currentRecordsOwner() !== startOwner) return setPhase({ kind: 'error', error: 'owner_changed' });
      const preview = await previewLearningImport(parsed.backup, startOwner).catch(() => null);
      if (!preview) return setPhase({ kind: 'error', error: 'failed' });
      if (!preview.ok || currentRecordsOwner() !== startOwner) return setPhase({ kind: 'error', error: 'owner_changed' });
      setPhase({ kind: 'preview', backup: parsed.backup, owner: startOwner, plan: preview.domains, fingerprint: backupFingerprint(picked.text) });
    } finally {
      busy.current = false;
    }
  };

  const apply = async (current: Extract<Phase, { kind: 'preview' }>) => {
    if (busy.current) return;
    busy.current = true;
    const { backup } = current;
    const props = { schema_version: backup.version, domain_count: Object.keys(backup.records).length };
    try {
      track('data_import_started', props);
      setPhase({ kind: 'applying', backup });
      const outcome = await applyLearningImport(backup, current.owner, undefined, { preview: current.plan, fingerprint: current.fingerprint }).catch((): ImportOutcome => ({ ok: false, error: 'apply_failed' }));
      if (!outcome.ok) {
        track('data_import_failed', props);
        return setPhase({ kind: 'error', error: FAILURE_PHASE[outcome.error] });
      }
      track('data_import_completed', props);
      setPhase({ kind: 'done', outcome, owner: current.owner });
    } finally {
      busy.current = false;
    }
  };

  const planLine = (entry: DomainSummary) =>
    [t('dataImport.planRow', { added: entry.added, updated: entry.updated, unchanged: entry.unchanged }), entry.skippedDeleted > 0 ? t('dataImport.skippedDeleted', { count: entry.skippedDeleted }) : null].filter(Boolean).join(' · ');

  return (
    <SettingsScreenLayout title={t('dataImport.title')} onPressBack={onPressBack}>
      <View style={styles.stack}>
        {interrupted && (phase.kind === 'idle' || phase.kind === 'error') ? (
          <View style={styles.notes} testID="import-interrupted">
            <Text style={styles.meta}>{t('dataImport.interrupted')}</Text>
            <Button label={t('dataImport.interruptedDismiss')} variant="secondary" size="sm" onPress={() => void dismissPendingImport().then(() => setInterrupted(false))} />
          </View>
        ) : null}

        {phase.kind === 'idle' || phase.kind === 'reading' || phase.kind === 'error' ? (
          <>
            <Text style={styles.body}>{t('dataImport.intro')}</Text>
            <Note icon={ShieldCheck} text={t(owner === 'guest' ? 'dataImport.ownerGuest' : 'dataImport.ownerAccount')} />
            <Note icon={Lock} text={t('dataImport.neverImported')} />
            {phase.kind === 'error' ? (
              <Text style={styles.error} accessibilityRole="alert" testID="import-error">
                {t(`dataImport.errors.${phase.error}`)}
              </Text>
            ) : null}
            {phase.kind === 'reading' ? <ActivityIndicator color={colors.primary} accessibilityLabel={t('dataImport.checking')} /> : <Button label={t('dataImport.choose')} icon={<FileUp size={16} color={colors.textOnPrimary} strokeWidth={2} />} onPress={() => void choose()} testID="import-choose" />}
          </>
        ) : null}

        {phase.kind === 'preview' ? (
          <>
            <Text style={styles.heading} accessibilityRole="header">
              {t('dataImport.previewTitle')}
            </Text>
            <Text style={styles.meta}>{t('dataImport.exportedAt', { date: new Date(phase.backup.exportedAt).toLocaleDateString() })}</Text>
            <View style={styles.card} testID="import-plan">
              {phase.plan.map((entry, index) => (
                <View key={entry.domain} style={[styles.row, index > 0 && styles.divider]} accessible accessibilityLabel={`${t(`dataImport.syncDomains.${entry.domain}`)}: ${planLine(entry)}`}>
                  <Text style={styles.rowLabel}>{t(`dataImport.syncDomains.${entry.domain}`)}</Text>
                  <Text style={styles.rowValue}>{planLine(entry)}</Text>
                </View>
              ))}
            </View>
            {phase.plan.every((entry) => entry.added + entry.updated === 0) ? <Text style={styles.meta}>{t('dataImport.nothingToChange')}</Text> : null}
            <Text style={styles.meta}>{t('dataImport.mergeMode')}</Text>
            <Text style={styles.meta}>{t('dataImport.retainRule')}</Text>
            {phase.plan.some((entry) => entry.kept > 0) ? <Text style={styles.meta}>{t('dataImport.kept', { count: phase.plan.reduce((sum, entry) => sum + entry.kept, 0) })}</Text> : null}
            {phase.backup.ignoredKeys.length > 0 ? <Text style={styles.meta}>{t('dataImport.ignoredCount', { count: phase.backup.ignoredKeys.length })}</Text> : null}
            {phase.backup.hasPrivateNotes ? (
              <View style={styles.notes}>
                <Text style={styles.rowLabel}>{t('dataImport.privateNotes')}</Text>
                <View style={styles.switchRow}>
                  <Text style={[styles.meta, { flex: 1 }]}>{t('dataImport.privateNotesConfirm')}</Text>
                  <Switch value={notesConfirmed} onValueChange={setNotesConfirmed} accessibilityLabel={t('dataImport.privateNotesConfirm')} />
                </View>
              </View>
            ) : null}
            <Button label={t('dataImport.apply')} disabled={phase.backup.hasPrivateNotes && !notesConfirmed} onPress={() => void apply(phase)} testID="import-apply" />
            <Button label={t('common.cancel')} variant="secondary" onPress={() => setPhase({ kind: 'idle' })} />
          </>
        ) : null}

        {phase.kind === 'applying' ? <ActivityIndicator color={colors.primary} accessibilityLabel={t('dataImport.applying')} /> : null}

        {phase.kind === 'done' ? (
          <>
            <Text style={styles.heading} accessibilityRole="header" accessibilityLiveRegion="polite">
              {t('dataImport.doneTitle')}
            </Text>
            <View style={styles.card} testID="import-result">
              {phase.outcome.domains.map((entry, index) => (
                <View key={entry.domain} style={[styles.row, index > 0 && styles.divider]}>
                  <Text style={styles.rowLabel}>{t(`dataImport.syncDomains.${entry.domain}`)}</Text>
                  <Text style={styles.rowValue}>
                    {t('dataImport.addedUpdated', { added: entry.added, updated: entry.updated })}
                    {entry.skippedDeleted > 0 ? ` · ${t('dataImport.skippedDeleted', { count: entry.skippedDeleted })}` : ''}
                  </Text>
                </View>
              ))}
              {phase.outcome.domains.length === 0 ? <Text style={[styles.meta, { padding: spacing.md }]}>{t('dataImport.nothingNew')}</Text> : null}
            </View>
            {!phase.outcome.matchesPreview ? <Text style={styles.meta}>{t('dataImport.changedSincePreview')}</Text> : null}
            {phase.outcome.unchanged.length > 0 ? <Text style={styles.meta}>{t('dataImport.unchanged', { list: phase.outcome.unchanged.map((domain) => t(`dataImport.syncDomains.${domain}`)).join(', ') })}</Text> : null}
            <Text style={styles.meta}>{t(`dataImport.cloud.${phase.outcome.cloud}`)}</Text>
            <Button label={t('dataImport.done')} onPress={onPressBack} />
          </>
        ) : null}
      </View>
    </SettingsScreenLayout>
  );
}

function Note({ icon: Icon, text }: { icon: typeof Lock; text: string }) {
  return (
    <View style={styles.note}>
      <Icon size={16} color={colors.primary} strokeWidth={2} />
      <Text style={[styles.meta, { flex: 1 }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  body: { ...textStyles.body, color: colors.textSecondary },
  heading: { ...typography.h2, color: colors.textPrimary },
  meta: { ...textStyles.small, color: colors.textSecondary },
  error: { ...textStyles.body, color: colors.accentTerracotta },
  note: { flexDirection: 'row', gap: spacing.xs, alignItems: 'flex-start' },
  card: { borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minHeight: 44 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: colors.borderSubtle },
  rowLabel: { ...textStyles.bodyMedium, color: colors.textPrimary, flex: 1 },
  rowValue: { ...textStyles.small, color: colors.textSecondary },
  notes: { gap: spacing.xs, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceWarm },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
