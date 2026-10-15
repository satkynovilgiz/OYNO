import { router, useFocusEffect } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconButton } from '@/components/ui';
import { unrecordedSave } from '@/features/firstUse/firstUseModel';
import { useRecordsOwner } from '@/features/games/records/useGameRecords';
import { announce } from '@/services/a11y/announce';
import { useExplanationsStore } from '@/store/useExplanationsStore';
import { useJournalDraftStore } from '@/store/useJournalDraftStore';
import { useJournalStore } from '@/store/useJournalStore';
import { ownerComparisons, useListeningCompareStore } from '@/store/useListeningCompareStore';
import { ownerPortfolio, usePortfolioStore } from '@/store/usePortfolioStore';
import { ownerQuestions, useQuestionsStore } from '@/store/useQuestionsStore';
import { ownerScrapbook, useScrapbookStore } from '@/store/useScrapbookStore';
import { ownerWorkspaces, useWorkspaceStore } from '@/store/useWorkspaceStore';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { discardEntry, retryEntry } from './recoveryActions';
import { listRecovery, type RecoveryEntry } from './recoveryModel';

/** /profile/recovery - unfinished work for the current owner, from the editors' own draft sources. */
export function RecoveryScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const owner = useRecordsOwner();
  const [version, setVersion] = useState(0);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ id: string; ok: boolean } | null>(null);
  const portfolios = usePortfolioStore((s) => s);
  const scrapbooks = useScrapbookStore((s) => s);
  const questions = useQuestionsStore((s) => s);
  const compare = useListeningCompareStore((s) => s);
  const journalDrafts = useJournalDraftStore((s) => s);
  const journal = useJournalStore((s) => s);
  const workspaces = useWorkspaceStore((s) => s);
  useEffect(() => {
    void usePortfolioStore.getState().load();
    void useScrapbookStore.getState().load();
    void useQuestionsStore.getState().load();
    void useListeningCompareStore.getState().load();
    void useJournalDraftStore.getState().load();
    void useExplanationsStore.getState().load();
    void useJournalStore.getState().load();
    void useWorkspaceStore.getState().load();
  }, []);
  // Drafts live in memory maps: re-read them whenever this screen is shown.
  useFocusEffect(useCallback(() => setVersion((v) => v + 1), []));
  const shownOwner = useRef(owner);
  useEffect(() => {
    shownOwner.current = owner;
    setConfirm(null);
    setMessage(null);
  }, [owner]);

  const ready = (status: string) => status === 'ready';
  const entries = listRecovery({
    owner,
    portfolioExists: (id) => (ready(portfolios.status) ? !!ownerPortfolio(portfolios.saved, owner, id) : undefined),
    scrapbookExists: (id) => (ready(scrapbooks.status) ? !!ownerScrapbook(scrapbooks.saved, owner, id) : undefined),
    question: (id) => (ready(questions.status) ? (ownerQuestions(questions.saved, owner)[id] ?? null) : undefined),
    comparison: (id) => {
      if (!ready(compare.status)) return undefined;
      const c = ownerComparisons(compare.saved, owner)[id];
      return c ? { a: c.a.title, b: c.b.title } : null;
    },
    journalDrafts: journalDrafts.isLoaded ? Object.values(journalDrafts.saved[owner] ?? {}) : [],
    journalEntryExists: (id) => (journal.isLoaded ? journal.entries.some((entry) => entry.id === id && !entry.deletedAt) : undefined),
    firstUse: unrecordedSave(owner),
    workspaceExists: (key) => (ready(workspaces.status) ? !!ownerWorkspaces(workspaces.saved, owner)[key] : undefined),
  });
  void version;

  const retry = async (entry: RecoveryEntry) => {
    const startedFor = owner;
    setBusy(entry.id);
    const ok = await retryEntry(startedFor, entry);
    setBusy(null);
    if (shownOwner.current !== startedFor) return; // another account meanwhile
    setMessage({ id: entry.id, ok });
    announce(ok ? t('recovery.retried') : t('recovery.retryFailed'));
    setVersion((v) => v + 1);
  };
  const discard = async (entry: RecoveryEntry) => {
    await discardEntry(owner, entry);
    setConfirm(null);
    announce(t('recovery.discarded'));
    setVersion((v) => v + 1);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
          {t('recovery.title')}
        </Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} testID="recovery">
        <Text style={styles.body}>{t('recovery.intro')}</Text>
        <Text style={styles.note}>{t('recovery.restartNote')}</Text>
        {entries.length === 0 ? (
          <Text style={styles.meta} testID="recovery-empty">
            {t('recovery.empty')}
          </Text>
        ) : null}
        {entries.map((entry) => (
          <View key={entry.id} style={styles.card} testID={`recovery-${entry.id}`}>
            <Text style={styles.label}>{t(`recovery.kinds.${entry.kind}`)}</Text>
            <Text style={styles.cardTitle}>{entry.title || t('recovery.untitled')}</Text>
            <Text style={styles.meta}>{t(`recovery.state.${entry.state}`)}</Text>
            <Text style={styles.meta}>{entry.survivesRestart ? t('recovery.survives') : t('recovery.memoryOnly')}</Text>
            {entry.parent === 'missing' ? (
              <Text style={styles.warn} testID={`recovery-parent-missing-${entry.id}`}>
                {t('recovery.parentMissing')}
              </Text>
            ) : null}
            {entry.parent === 'loading' ? <Text style={styles.meta}>{t('recovery.loading')}</Text> : null}
            {!entry.retry && entry.state === 'unsaved' && entry.parent !== 'missing' ? <Text style={styles.meta}>{t('recovery.openToSave')}</Text> : null}
            <View style={styles.wrap}>
              {entry.parent !== 'missing' ? <Button label={t('recovery.open')} variant="secondary" size="sm" onPress={() => router.push(entry.route as never)} testID={`recovery-open-${entry.id}`} /> : null}
              {entry.retry ? (
                <Button label={entry.kind === 'firstUse' ? t('recovery.recordStep') : t('recovery.retrySave')} size="sm" loading={busy === entry.id} onPress={() => void retry(entry)} testID={`recovery-retry-${entry.id}`} />
              ) : null}
              <Button label={t('recovery.discard')} variant="text" size="sm" onPress={() => setConfirm(entry.id)} testID={`recovery-discard-${entry.id}`} />
            </View>
            {message?.id === entry.id && !message.ok ? <Text style={styles.warn}>{t('recovery.retryFailed')}</Text> : null}
            {confirm === entry.id ? (
              <View style={styles.confirm} testID={`recovery-confirm-${entry.id}`}>
                <Text style={styles.body}>{entry.kind === 'firstUse' ? t('recovery.discardPending') : t('recovery.discardConfirm')}</Text>
                <View style={styles.wrap}>
                  <Button label={t('recovery.discardYes')} size="sm" onPress={() => void discard(entry)} testID={`recovery-discard-yes-${entry.id}`} />
                  <Button label={t('common.cancel')} variant="text" size="sm" onPress={() => setConfirm(null)} />
                </View>
              </View>
            ) : null}
          </View>
        ))}
        {message?.ok ? (
          <Text style={styles.body} accessibilityLiveRegion="polite" testID="recovery-retried">
            {t('recovery.retried')}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center' },
  label: { ...textStyles.overline, color: colors.primary },
  body: { ...textStyles.body, color: colors.textPrimary },
  meta: { ...textStyles.small, color: colors.textSecondary },
  warn: { ...textStyles.small, fontWeight: '700', color: colors.accentTerracottaText },
  note: { ...textStyles.small, color: colors.textPrimary, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceMuted },
  card: { gap: spacing.xs, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  cardTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  confirm: { gap: spacing.xs, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceMuted },
});
