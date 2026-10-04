import { router } from 'expo-router';
import { BookOpenText, Download, FileUp, HardDrive, Headphones, NotebookPen, RefreshCw, RotateCcw, Trash2, UserX } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, ConfirmationModal } from '@/components/ui';
import { showToast } from '@/components/ui/Toast';
import { useRecordsOwner } from '@/features/games/records/useGameRecords';
import { track } from '@/services/analytics/analytics';
import { formatDateTime } from '@/services/i18n/formatDate';
import { useOfflineStore } from '@/services/offline/useOfflineStore';
import { syncAccountState } from '@/services/sync/syncEngine';
import { usePrivateSyncStatus, wipePrivateDomains, type WipeOutcome } from '@/services/sync/privateSync/privateSync';
import { useAuthStore } from '@/store/useAuthStore';
import { ownerMistakes, useChallengeMistakesStore } from '@/store/useChallengeMistakesStore';
import { useFavoritesStore } from '@/store/useFavoritesStore';
import { useGameRecordsStore, EMPTY_RECORDS } from '@/store/useGameRecordsStore';
import { ownerStudy, useGlossaryStudyStore } from '@/store/useGlossaryStudyStore';
import { ownerHighlights, useHighlightsStore } from '@/store/useHighlightsStore';
import { useJournalStore } from '@/store/useJournalStore';
import { ownerLibrary, useKomuzLibraryStore } from '@/store/useKomuzLibraryStore';
import { ownerManualSteps, useLearningPathStore } from '@/store/useLearningPathStore';
import { ownerListening, useListeningStore } from '@/store/useListeningStore';
import { ownerCollections, useMyCollectionsStore } from '@/store/useMyCollectionsStore';
import { ownerReading, useReadingStore } from '@/store/useReadingStore';
import { ownerGoal, useWeeklyGoalStore } from '@/store/useWeeklyGoalStore';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { SettingsRow, SettingsSection } from '../components/SettingsRow';
import { SettingsScreenLayout } from '../components/SettingsScreenLayout';
import { DATA_CATEGORIES, RESET_DOMAINS, SYNCED_DOMAIN_LABELS, categoryStatus, cloudSyncView, resetIsEmpty, type DataCategory } from './dataPrivacyModel';
import { learningExportSupported, shareLearningExport } from './exportLearningData';
import { buildLearningExport, exportFileName } from './learningExport';


const NO_SESSIONS: string[] = [];
/**
 * /settings/data-privacy - what OYNO really stores, where, and the real
 * actions over it. Every number is the CURRENT owner's (account switch ->
 * the other person's numbers at once); no byte sizes are estimated.
 */
export function DataPrivacyScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t, i18n } = useTranslation();
  const owner = useRecordsOwner();
  const signedIn = useAuthStore((state) => state.status === 'authenticated' && !!state.user);
  const syncState = usePrivateSyncStatus((state) => state.state);
  const backend = usePrivateSyncStatus((state) => state.backend);
  const syncedAt = usePrivateSyncStatus((state) => state.syncedOwners[owner] ?? null);
  const context = { signedIn, backend, privateSyncedAt: signedIn ? syncedAt : null };

  const reading = ownerReading(useReadingStore((state) => state.saved), owner);
  const highlights = ownerHighlights(useHighlightsStore((state) => state.saved), owner);
  const collections = ownerCollections(useMyCollectionsStore((state) => state.saved), owner);
  const mistakes = ownerMistakes(useChallengeMistakesStore((state) => state.saved), owner);
  const study = ownerStudy(useGlossaryStudyStore((state) => state.saved), owner);
  const sessions = useGlossaryStudyStore((state) => state.sessions[owner] ?? NO_SESSIONS);
  const listening = ownerListening(useListeningStore((state) => state.saved), owner);
  const pathSteps = ownerManualSteps(useLearningPathStore((state) => state.saved), owner);
  const records = useGameRecordsStore((state) => state.saved[owner] ?? EMPTY_RECORDS);
  const komuz = ownerLibrary(useKomuzLibraryStore((state) => state.saved), owner);
  const goal = ownerGoal(useWeeklyGoalStore((state) => state.saved), owner);
  const journalCount = useJournalStore((state) => state.entries.filter((entry) => !entry.deletedAt).length);
  const savedCount = useFavoritesStore((state) => state.favoriteIds.length);
  const downloads = useOfflineStore((state) => Object.values(state.manifest.entries).filter((entry) => entry.kind !== 'culture_index').length);

  const [confirm, setConfirm] = useState<'downloads' | 'history' | 'reset' | 'export' | null>(null);
  const [busy, setBusy] = useState(false);
  const [domainsOpen, setDomainsOpen] = useState(false);

  useEffect(() => {
    track('privacy_center_opened');
    for (const store of [useReadingStore, useHighlightsStore, useMyCollectionsStore, useChallengeMistakesStore, useGlossaryStudyStore, useListeningStore, useLearningPathStore, useGameRecordsStore, useKomuzLibraryStore, useWeeklyGoalStore]) {
      void (store.getState() as { load: () => Promise<void> }).load();
    }
  }, []);

  const historyCount = Object.keys(listening.history).length;
  const bookmarkCount = Object.keys(listening.bookmarks).length;
  const pathStepCount = Object.values(pathSteps).reduce((sum, steps) => sum + Object.keys(steps).length, 0);
  const preview = { readingRecords: Object.keys(reading).length, mistakes: Object.keys(mistakes.active).length, studiedTerms: Object.keys(study).length, studySessions: sessions.length, pathSteps: pathStepCount };

  const countFor: Record<DataCategory, string | null> = {
    account_progress: null,
    private_learning: t('dataPrivacy.counts.reading', { count: preview.readingRecords }),
    journal: t('dataPrivacy.counts.journal', { count: journalCount }),
    saved: t('dataPrivacy.counts.saved', { count: savedCount }),
    offline_downloads: t('dataPrivacy.counts.downloads', { count: downloads }),
    listening: `${t('dataPrivacy.counts.history', { count: historyCount })} · ${t('dataPrivacy.counts.bookmarks', { count: bookmarkCount })}`,
    highlights: `${t('dataPrivacy.counts.passages', { count: Object.keys(highlights).length })} · ${t('dataPrivacy.counts.collections', { count: collections.collections.length })}`,
  };

  const cloud = cloudSyncView(context, syncState);
  const outcomeMessage = (outcome: WipeOutcome) => t(`dataPrivacy.outcome.${outcome}`);

  const run = async (action: NonNullable<typeof confirm>) => {
    setBusy(true);
    try {
      if (action === 'downloads') {
        // Offline copies only - progress, Journal, notes and collections are untouched.
        await useOfflineStore.getState().removeAll();
        showToast(t('dataPrivacy.downloadsCleared'));
      } else if (action === 'history') {
        showToast(outcomeMessage(await wipePrivateDomains(owner, ['listening_history'])));
      } else if (action === 'reset') {
        track('private_data_reset');
        showToast(outcomeMessage(await wipePrivateDomains(owner, RESET_DOMAINS)));
      } else if (action === 'export') {
        track('data_export_started');
        const json = JSON.stringify(
          buildLearningExport(
            { reading, highlights, collections, mistakes, glossaryStudy: study, glossarySessions: sessions, gameRecords: records, komuzFavorites: komuz.favorites, pathSteps, listening, weeklyGoal: goal.goal },
            new Date(),
          ),
          null,
          2,
        );
        const result = await shareLearningExport(json, exportFileName(new Date()));
        if (result !== 'shared') showToast(t(result === 'unsupported' ? 'dataPrivacy.exportUnsupported' : 'dataPrivacy.exportFailed'), { tone: 'info' });
      }
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const resetLines = [
    t('dataPrivacy.reset.reading', { count: preview.readingRecords }),
    t('dataPrivacy.reset.mistakes', { count: preview.mistakes }),
    t('dataPrivacy.reset.terms', { count: preview.studiedTerms }),
    t('dataPrivacy.reset.sessions', { count: preview.studySessions }),
    t('dataPrivacy.reset.pathSteps', { count: preview.pathSteps }),
  ];
  const cloudLine = signedIn ? (backend === 'missing' ? t('dataPrivacy.reset.cloudUnavailable') : t('dataPrivacy.reset.cloud')) : t('dataPrivacy.reset.deviceOnly');

  return (
    <SettingsScreenLayout title={t('dataPrivacy.title')} onPressBack={onPressBack}>
      <View style={styles.stack}>
        <Text style={styles.intro}>{t('dataPrivacy.intro')}</Text>

        <View style={styles.card}>
          {DATA_CATEGORIES.map((category, index) => {
            const status = categoryStatus(category, context);
            const count = countFor[category];
            return (
              <View key={category} style={[styles.row, index > 0 && styles.divider]} accessible accessibilityLabel={`${t(`dataPrivacy.category.${category}`)}. ${t(`dataPrivacy.status.${status}`)}.${count ? ` ${count}.` : ''}`}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.rowTitle}>{t(`dataPrivacy.category.${category}`)}</Text>
                  {count ? <Text style={styles.meta}>{count}</Text> : null}
                </View>
                <Text style={[styles.badge, status === 'account' && styles.badgeAccount, status === 'not_synced' && styles.badgeMuted]}>{t(`dataPrivacy.status.${status}`)}</Text>
              </View>
            );
          })}
        </View>

        <SettingsSection title={t('dataPrivacy.cloudTitle')} footer={cloud.lastSyncedAt ? t('dataPrivacy.lastSynced', { time: formatDateTime(cloud.lastSyncedAt, i18n.language) }) : undefined}>
          <SettingsRow icon={RefreshCw} label={t('dataPrivacy.cloudTitle')} value={t(`dataPrivacy.cloud.${cloud.view}`)} showChevron={false} onPress={signedIn && backend !== 'missing' ? () => void syncAccountState('foreground') : undefined} />
          <SettingsRow icon={BookOpenText} label={t('dataPrivacy.learningData')} onPress={() => setDomainsOpen(true)} />
        </SettingsSection>

        <View style={styles.explain}>
          <Text style={styles.explainTitle}>{t('dataPrivacy.howTitle')}</Text>
          <Text style={styles.explainLine}>• {t('dataPrivacy.how.guest')}</Text>
          <Text style={styles.explainLine}>• {t('dataPrivacy.how.signedIn')}</Text>
          <Text style={styles.explainLine}>• {t('dataPrivacy.how.offline')}</Text>
        </View>

        <SettingsSection title={t('dataPrivacy.actionsTitle')}>
          <SettingsRow icon={HardDrive} label={t('storage.title')} subtitle={t('storage.items', { count: downloads })} onPress={() => router.push('/settings/storage' as never)} />
          <SettingsRow icon={Download} label={t('dataPrivacy.clearDownloads')} subtitle={t('dataPrivacy.counts.downloads', { count: downloads })} onPress={() => setConfirm('downloads')} />
          <SettingsRow icon={Headphones} label={t('dataPrivacy.clearHistory')} subtitle={t('dataPrivacy.counts.history', { count: historyCount })} onPress={() => setConfirm('history')} />
          <SettingsRow icon={RotateCcw} label={t('dataPrivacy.resetLearning')} destructive onPress={() => setConfirm('reset')} />
          {learningExportSupported() ? <SettingsRow icon={Download} label={t('dataPrivacy.export')} onPress={() => setConfirm('export')} /> : null}
          <SettingsRow icon={FileUp} label={t('dataImport.title')} onPress={() => router.push('/settings/data-privacy/import' as never)} />
        </SettingsSection>
        {!learningExportSupported() ? <Text style={styles.meta}>{t('dataPrivacy.exportUnsupported')}</Text> : null}

        <SettingsSection footer={t('dataPrivacy.journalNote')}>
          <SettingsRow icon={NotebookPen} label={t('dataPrivacy.manageJournal')} onPress={() => router.push('/journal' as never)} />
          {signedIn ? <SettingsRow icon={UserX} label={t('dataPrivacy.deleteAccount')} onPress={() => router.push('/settings/account' as never)} /> : null}
        </SettingsSection>
      </View>

      <ConfirmationModal
        visible={confirm === 'downloads'}
        title={t('dataPrivacy.clearDownloads')}
        message={t('dataPrivacy.confirm.downloads')}
        confirmLabel={t('dataPrivacy.clearDownloads')}
        cancelLabel={t('common.cancel')}
        destructive
        isConfirming={busy}
        onConfirm={() => void run('downloads')}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmationModal
        visible={confirm === 'history'}
        title={t('dataPrivacy.clearHistory')}
        message={`${t('dataPrivacy.confirm.history', { count: historyCount })}\n\n${cloudLine}`}
        confirmLabel={t('dataPrivacy.clearHistoryOnly')}
        cancelLabel={t('common.cancel')}
        destructive
        isConfirming={busy}
        onConfirm={() => void run('history')}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmationModal
        visible={confirm === 'reset'}
        title={t('dataPrivacy.resetLearning')}
        message={resetIsEmpty(preview) ? t('dataPrivacy.reset.nothing') : `${t('dataPrivacy.reset.willRemove')}\n${resetLines.map((line) => `• ${line}`).join('\n')}\n\n${t('dataPrivacy.reset.kept')}\n\n${cloudLine}\n${t('dataPrivacy.cannotUndo')}`}
        confirmLabel={t('dataPrivacy.resetConfirm')}
        cancelLabel={t('common.cancel')}
        destructive
        isConfirming={busy}
        onConfirm={() => (resetIsEmpty(preview) ? setConfirm(null) : void run('reset'))}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmationModal
        visible={confirm === 'export'}
        title={t('dataPrivacy.export')}
        message={`${t('dataPrivacy.confirm.export')}\n\n${t('dataPrivacy.notesIncluded')}`}
        confirmLabel={t('dataPrivacy.exportConfirm')}
        cancelLabel={t('common.cancel')}
        isConfirming={busy}
        onConfirm={() => void run('export')}
        onCancel={() => setConfirm(null)}
      />

      <Modal visible={domainsOpen} transparent animationType="fade" onRequestClose={() => setDomainsOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setDomainsOpen(false)} accessibilityRole="button" accessibilityLabel={t('common.close')} />
        <View style={styles.sheet} accessibilityViewIsModal>
          <Text style={styles.sheetTitle} accessibilityRole="header">
            {t('dataPrivacy.learningData')}
          </Text>
          <Text style={styles.meta}>{t(signedIn ? 'dataPrivacy.learningDataSignedIn' : 'dataPrivacy.learningDataGuest')}</Text>
          <ScrollView style={{ maxHeight: 360 }}>
            {SYNCED_DOMAIN_LABELS.map((entry) => (
              <Text key={entry.key} style={styles.domain}>
                • {t(`dataPrivacy.domains.${entry.key}`)}
              </Text>
            ))}
          </ScrollView>
          <Button label={t('common.close')} variant="secondary" onPress={() => setDomainsOpen(false)} />
        </View>
      </Modal>
    </SettingsScreenLayout>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg },
  intro: { ...textStyles.body, color: colors.textSecondary },
  card: { borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  divider: { borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: colors.borderSubtle },
  rowTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  meta: { ...textStyles.small, color: colors.textSecondary },
  badge: { ...textStyles.small, fontWeight: '700', color: colors.textSecondary, maxWidth: 140, textAlign: 'right' },
  badgeAccount: { color: colors.primary },
  badgeMuted: { color: colors.textMuted },
  explain: { gap: 4, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surface },
  explainTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  explainLine: { ...textStyles.small, color: colors.textSecondary },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { position: 'absolute', left: spacing.lg, right: spacing.lg, top: '20%', gap: spacing.sm, padding: spacing.lg, borderRadius: cardRadii.compact, backgroundColor: colors.background },
  sheetTitle: { ...typography.h2, color: colors.textPrimary },
  domain: { ...textStyles.body, color: colors.textPrimary, paddingVertical: 4 },
});
