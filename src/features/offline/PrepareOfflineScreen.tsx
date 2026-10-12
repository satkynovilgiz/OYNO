import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button, IconButton } from '@/components/ui';
import { useRecordsOwner } from '@/features/games/records/useGameRecords';
import { LEARNING_PATHS } from '@/features/learn/learningPaths';
import { useStepDisplay } from '@/features/learn/useStepDisplay';
import { activityFor } from '@/features/nextVisit/nextVisitModel';
import { announce } from '@/services/a11y/announce';
import { useAllCultureItems } from '@/services/content/cultureItemsService';
import { useNetworkStatus } from '@/services/offline/networkStatus';
import { measureEntriesBytes } from '@/services/offline/offlineCache';
import { formatBytes } from '@/services/offline/offlineModel';
import { buildPreparePlan, prepareCancel, prepareDownload, readiness, type PrepareSource } from '@/services/offline/preparePlan';
import { useOfflineStore } from '@/services/offline/useOfflineStore';
import { ownerQueue, useNextVisitStore } from '@/store/useNextVisitStore';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

/**
 * /prepare-offline - choose a journey or your My Next Visit plan, see what
 * already works offline, download only what is missing, retry failures,
 * cancel (keeping finished downloads). Sizes are real measurements of what
 * is on the device; before a download, "Size unknown".
 */
export function PrepareOfflineScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const owner = useRecordsOwner();
  const { isOffline } = useNetworkStatus();
  const items = useAllCultureItems();
  const display = useStepDisplay();
  const manifest = useOfflineStore((state) => state.manifest);
  const inFlight = useOfflineStore((state) => state.inFlight);
  const failed = useOfflineStore((state) => state.failed);
  const queueRaw = useNextVisitStore((state) => state.saved[owner]);
  const queue = useMemo(() => ownerQueue({ [owner]: queueRaw } as never, owner), [owner, queueRaw]);
  const [source, setSource] = useState<PrepareSource>({ kind: 'plan' });
  const [bytes, setBytes] = useState<number | null>(null);
  useEffect(() => {
    void useOfflineStore.getState().load();
    void useNextVisitStore.getState().load();
  }, []);
  const ids = useMemo(() => new Map((items.data ?? []).map((item) => [item.id, item])), [items.data]);
  const plan = buildPreparePlan(source, { queue, articleExists: (id) => (items.data ? ids.has(id) : undefined) });
  const state = plan ? readiness(plan, manifest, inFlight, failed) : null;
  const downloadedKey = state?.downloadedEntries.map((entry) => entry.id).join('|') ?? '';
  useEffect(() => {
    let live = true;
    setBytes(null);
    if (state && state.downloadedEntries.length) void measureEntriesBytes(state.downloadedEntries).then((value) => live && setBytes(value));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [downloadedKey]);

  const sources: { source: PrepareSource; label: string }[] = [{ source: { kind: 'plan' }, label: t('prepareOffline.planSource') }, ...LEARNING_PATHS.map((path) => ({ source: { kind: 'path', pathId: path.id } as PrepareSource, label: t(path.titleKey) }))];
  const same = (a: PrepareSource, b: PrepareSource) => a.kind === b.kind && (a.kind === 'plan' || (b.kind === 'path' && a.pathId === b.pathId));
  const label = (index: number) => {
    const resource = plan!.resources[index];
    if (resource.kind === 'step') {
      const path = LEARNING_PATHS.find((entry) => entry.id === (source.kind === 'path' ? source.pathId : ''));
      const step = path?.steps.find((entry) => entry.id === resource.id);
      return step ? `${display(step).verb}: ${display(step).title}` : resource.id;
    }
    if (resource.kind === 'article') return ids.get(resource.id)?.title ?? queue.find((q) => q.id === resource.id)?.titleSnapshot ?? resource.id;
    const activity = activityFor(resource.id);
    return activity?.titleKey ? t(activity.titleKey) : (queue.find((q) => q.id === resource.id)?.titleSnapshot ?? resource.id);
  };
  const start = async () => {
    if (!plan) return;
    announce(t('prepareOffline.started'));
    await prepareDownload(plan, useOfflineStore.getState);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
          {t('prepareOffline.title')}
        </Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} testID="prepare-offline">
        <Text style={styles.body}>{t('prepareOffline.intro')}</Text>
        <Text style={styles.note}>{t('prepareOffline.privateNote')}</Text>

        <Text style={styles.section}>{t('prepareOffline.chooseTitle')}</Text>
        <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel={t('prepareOffline.chooseTitle')}>
          {sources.map((entry) => {
            const on = same(entry.source, source);
            const id = entry.source.kind === 'plan' ? 'plan' : entry.source.pathId;
            return (
              <AnimatedPressable key={id} style={[styles.chip, on && styles.chipOn]} onPress={() => setSource(entry.source)} accessibilityRole="radio" accessibilityState={{ checked: on }} aria-checked={on} testID={`prepare-source-${id}`}>
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{entry.label}</Text>
              </AnimatedPressable>
            );
          })}
        </View>

        {!plan || !state ? null : plan.resources.length === 0 ? (
          <View style={styles.stack} testID="prepare-empty">
            <Text style={styles.meta}>{t('prepareOffline.planEmpty')}</Text>
            <Button label={t('prepareOffline.openPlan')} variant="secondary" onPress={() => router.push('/profile/next-visit' as never)} />
          </View>
        ) : (
          <View style={styles.stack}>
            <View style={styles.card} testID="prepare-summary" accessible accessibilityLiveRegion="polite">
              <Text style={styles.cardTitle}>{t('prepareOffline.ready', { ready: state.ready, total: state.total })}</Text>
              <Text style={styles.meta}>{state.downloadedEntries.length ? (bytes === null ? t('prepareOffline.measuring') : t('prepareOffline.storedSize', { size: formatBytes(bytes, t('offline.v2.units', { returnObjects: true }) as { b: string; kb: string; mb: string }) })) : t('prepareOffline.nothingStored')}</Text>
              {state.missingItems.length ? <Text style={styles.meta}>{t('prepareOffline.toDownload', { count: state.missingItems.length })}</Text> : null}
            </View>

            {plan.resources.map((resource, index) => {
              const s = state.states[index];
              return (
                <View key={resource.key} style={styles.row} testID={`prepare-resource-${index}`}>
                  <View style={styles.flex}>
                    <Text style={styles.body}>{label(index)}</Text>
                    <Text style={[styles.meta, s === 'failed' && styles.warn]} testID={`prepare-state-${index}`}>
                      {t(`prepareOffline.state.${s}`)}
                    </Text>
                  </View>
                  {s === 'downloading' ? <ActivityIndicator size="small" color={colors.primary} accessibilityLabel={t('prepareOffline.state.downloading')} /> : null}
                </View>
              );
            })}

            {isOffline && state.missingItems.length ? <Text style={styles.warn}>{t('prepareOffline.needsConnection')}</Text> : null}
            {state.missingItems.length && !state.downloading ? (
              <Button label={state.failedItems.length ? t('prepareOffline.retry', { count: state.missingItems.length }) : t('prepareOffline.download', { count: state.missingItems.length })} disabled={isOffline} onPress={start} testID="prepare-download" />
            ) : null}
            {state.downloading ? <Button label={t('prepareOffline.cancel')} variant="secondary" onPress={() => void prepareCancel(plan, useOfflineStore.getState)} accessibilityHint={t('prepareOffline.cancelHint')} testID="prepare-cancel" /> : null}
            {!state.missingItems.length ? (
              <Text style={styles.body} testID="prepare-all-ready">
                {state.ready === state.total ? t('prepareOffline.allReady') : t('prepareOffline.readyExcept')}
              </Text>
            ) : null}
            <Text style={styles.meta}>{t('prepareOffline.failureNote')}</Text>
          </View>
        )}
        <Button label={t('prepareOffline.manage')} variant="text" onPress={() => router.push('/offline' as never)} testID="prepare-manage" />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  stack: { gap: spacing.sm },
  flex: { flex: 1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
  section: { ...typography.overline, color: colors.textSecondary, marginTop: spacing.sm },
  body: { ...textStyles.body, color: colors.textPrimary },
  meta: { ...textStyles.small, color: colors.textSecondary },
  warn: { ...textStyles.small, fontWeight: '700', color: colors.accentTerracottaText },
  note: { ...textStyles.small, color: colors.textPrimary, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceMuted },
  card: { gap: spacing.xs, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  cardTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: 22, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...textStyles.bodyMedium, color: colors.textPrimary },
  chipTextOn: { color: colors.textOnPrimary, fontWeight: '700' },
});
