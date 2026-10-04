import { FileUp, Lock, ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Switch, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { useRecordsOwner } from '@/features/games/records/useGameRecords';
import { track } from '@/services/analytics/analytics';
import { useTrackScreenView } from '@/services/analytics/useTrackScreenView';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { SettingsScreenLayout } from '../components/SettingsScreenLayout';
import { applyLearningImport, type ImportOutcome } from './applyLearningImport';
import { parseLearningBackup, PREVIEW_ORDER, type ImportError, type ParsedBackup } from './learningImport';
import { pickBackupFile } from './pickBackupFile';

type Phase =
  | { kind: 'idle' }
  | { kind: 'reading' }
  | { kind: 'error'; error: ImportError | 'unsupported' | 'failed' }
  | { kind: 'preview'; backup: ParsedBackup; owner: string }
  | { kind: 'applying'; backup: ParsedBackup }
  | { kind: 'done'; outcome: Extract<ImportOutcome, { ok: true }> };

/**
 * /settings/data-privacy/import - "Import OYNO backup". Choosing a file only
 * reads and checks it (nothing changes); the preview lists what it holds;
 * only "Import and merge" changes data - merged with what is already here,
 * for the person who is signed in now (or the guest), never replacing it.
 */
export function ImportBackupScreen({ onPressBack }: { onPressBack: () => void }) {
  useTrackScreenView('data_import');
  const { t } = useTranslation();
  const owner = useRecordsOwner();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [notesConfirmed, setNotesConfirmed] = useState(false);

  const choose = async () => {
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
    setPhase({ kind: 'preview', backup: parsed.backup, owner });
  };

  const apply = async (backup: ParsedBackup, expectedOwner: string) => {
    const props = { schema_version: backup.version, domain_count: Object.keys(backup.records).length };
    track('data_import_started', props);
    setPhase({ kind: 'applying', backup });
    const outcome = await applyLearningImport(backup, expectedOwner).catch((): ImportOutcome => ({ ok: false, error: 'apply_failed' }));
    if (!outcome.ok) {
      track('data_import_failed', props);
      return setPhase({ kind: 'error', error: 'failed' });
    }
    track('data_import_completed', props);
    setPhase({ kind: 'done', outcome });
  };

  return (
    <SettingsScreenLayout title={t('dataImport.title')} onPressBack={onPressBack}>
      <View style={styles.stack}>
        {phase.kind === 'idle' || phase.kind === 'reading' || phase.kind === 'error' ? (
          <>
            <Text style={styles.body}>{t('dataImport.intro')}</Text>
            <Note icon={ShieldCheck} text={t(owner === 'guest' ? 'dataImport.ownerGuest' : 'dataImport.ownerAccount')} />
            <Note icon={Lock} text={t('dataImport.neverImported')} />
            {phase.kind === 'error' ? (
              <Text style={styles.error} accessibilityRole="alert">
                {t(`dataImport.errors.${phase.error}`)}
              </Text>
            ) : null}
            {phase.kind === 'reading' ? <ActivityIndicator color={colors.primary} /> : <Button label={t('dataImport.choose')} icon={<FileUp size={16} color={colors.textOnPrimary} strokeWidth={2} />} onPress={() => void choose()} />}
          </>
        ) : null}

        {phase.kind === 'preview' ? (
          <>
            <Text style={styles.heading} accessibilityRole="header">
              {t('dataImport.previewTitle')}
            </Text>
            <Text style={styles.meta}>{t('dataImport.exportedAt', { date: new Date(phase.backup.exportedAt).toLocaleDateString() })}</Text>
            <View style={styles.card}>
              {PREVIEW_ORDER.filter((key) => phase.backup.counts[key]).map((key, index) => (
                <View key={key} style={[styles.row, index > 0 && styles.divider]} accessible accessibilityLabel={`${t(`dataImport.domains.${key}`)}: ${key === 'weeklyGoal' ? t('dataImport.included') : phase.backup.counts[key]}`}>
                  <Text style={styles.rowLabel}>{t(`dataImport.domains.${key}`)}</Text>
                  <Text style={styles.rowValue}>{key === 'weeklyGoal' ? t('dataImport.included') : phase.backup.counts[key]}</Text>
                </View>
              ))}
            </View>
            {phase.backup.ignoredKeys.length > 0 ? <Text style={styles.meta}>{t('dataImport.ignored')}</Text> : null}
            <Text style={styles.meta}>{t('dataImport.mergeMode')}</Text>
            {phase.backup.hasPrivateNotes ? (
              <View style={styles.notes}>
                <Text style={styles.rowLabel}>{t('dataImport.privateNotes')}</Text>
                <View style={styles.switchRow}>
                  <Text style={[styles.meta, { flex: 1 }]}>{t('dataImport.privateNotesConfirm')}</Text>
                  <Switch value={notesConfirmed} onValueChange={setNotesConfirmed} accessibilityLabel={t('dataImport.privateNotesConfirm')} />
                </View>
              </View>
            ) : null}
            <Button label={t('dataImport.apply')} disabled={phase.backup.hasPrivateNotes && !notesConfirmed} onPress={() => void apply(phase.backup, phase.owner)} />
            <Button label={t('common.cancel')} variant="secondary" onPress={() => setPhase({ kind: 'idle' })} />
          </>
        ) : null}

        {phase.kind === 'applying' ? <ActivityIndicator color={colors.primary} accessibilityLabel={t('dataImport.applying')} /> : null}

        {phase.kind === 'done' ? (
          <>
            <Text style={styles.heading} accessibilityRole="header" accessibilityLiveRegion="polite">
              {t('dataImport.doneTitle')}
            </Text>
            <View style={styles.card}>
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
