import { router } from 'expo-router';
import { ArrowDownToLine, CloudOff, HardDrive, Info } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type ImageSourcePropType, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LibraryEmptyState, LibraryHeader } from '@/components/library/LibraryChrome';
import { Button, ConfirmationModal, SectionHeader } from '@/components/ui';
import { showToast } from '@/components/ui/Toast';
import { getCollection } from '@/features/collections/collectionsData';
import { cultureItemImages } from '@/features/culture/data';
import { natureSiteImages } from '@/features/explore/data';
import type { SupportedLanguage } from '@/i18n';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { useAllCultureItems } from '@/services/content/cultureItemsService';
import { useExploreRegions } from '@/services/content/exploreService';
import { mapExploreRegionName } from '@/services/content/types';
import { formatShortDate } from '@/services/i18n/formatDate';
import { useNetworkStatus } from '@/services/offline/networkStatus';
import type { OfflineKind } from '@/services/offline/offlineManifest';
import { buildOfflineView, formatBytes, type OfflineRow } from '@/services/offline/offlineModel';
import { useOfflineStore } from '@/services/offline/useOfflineStore';
import { localDateKey } from '@/services/daily/dailyDiscovery';
import { cardRadii, colors, spacing, textStyles } from '@/theme';

import { OfflineContentRow } from './OfflineContentRow';

/**
 * Offline Downloads - a calm content manager over the REAL offline store:
 *   summary      real item count + measured bytes actually stored
 *   Downloading  shown only while something is running (indeterminate -
 *                the download layer exposes no byte progress)
 *   Needs attention  only failed downloads with no usable copy: Retry
 *                    (the same store.download) / Remove
 *   groups       Places / Collections / Culture, newest first
 *   info         one short, accurate note about what works offline
 * Removing deletes only the offline copy - never favorites, progress,
 * Passport stamps, Journey or journal links. Downloads are device-wide
 * public content (not tied to an account), so they stay across sign-in.
 */
export function OfflineDownloadsScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const { isOffline } = useNetworkStatus();
  const manifest = useOfflineStore((state) => state.manifest);
  const inFlight = useOfflineStore((state) => state.inFlight);
  const failed = useOfflineStore((state) => state.failed);
  const { data: regions } = useExploreRegions();
  const { data: cultureItems } = useAllCultureItems();
  const [bytes, setBytes] = useState<number | null>(null);
  const [removing, setRemoving] = useState<string[]>([]);
  const [confirmAll, setConfirmAll] = useState(false);
  const [confirmOne, setConfirmOne] = useState<{ id: string; title: string } | null>(null);

  const view = useMemo(() => buildOfflineView(manifest, inFlight, failed, removing), [manifest, inFlight, failed, removing]);
  const isChild = experience === 'child';
  const isAdult = experience === 'adult';

  useEffect(() => {
    let cancelled = false;
    void useOfflineStore
      .getState()
      .measureBytes()
      .then((value) => !cancelled && setBytes(value))
      .catch(() => !cancelled && setBytes(null));
    return () => {
      cancelled = true;
    };
  }, [manifest]);

  function describe(kind: OfflineKind, contentId: string): { title: string; image: ImageSourcePropType | null; type: string } {
    const type = t(`saved.contentTypes.${kind}`);
    if (kind === 'nature') {
      const row = regions?.find((region) => region.id === contentId);
      const name = row ? mapExploreRegionName(row) : null;
      return { title: name ? (name[language] ?? name.kg) : t('notificationsScreen.v2.offlineContent'), image: natureSiteImages[contentId] ?? null, type };
    }
    if (kind === 'collection') {
      const collection = getCollection(contentId);
      return { title: collection ? (collection.title[language] ?? collection.title.kg) : t('notificationsScreen.v2.offlineContent'), image: collection?.heroImage ?? null, type: t('collections.sectionTitle') };
    }
    return { title: cultureItems?.find((item) => item.id === contentId)?.title ?? t('notificationsScreen.v2.offlineContent'), image: cultureItemImages[contentId]?.[0] ?? null, type };
  }

  async function remove(id: string) {
    setRemoving((current) => [...current, id]);
    try {
      await useOfflineStore.getState().remove(id);
      showToast(t('offline.v2.removed'));
    } finally {
      setRemoving((current) => current.filter((entry) => entry !== id));
    }
  }

  function retry(row: OfflineRow) {
    showToast(t('offline.v2.retryStarted'), { tone: 'info' });
    // Same download path as the detail screens - success updates the real
    // manifest (and the Notifications inbox records it once).
    void useOfflineStore.getState().download(row.kind, row.contentId);
  }

  function renderRow(row: OfflineRow, compact = false) {
    const info = describe(row.kind, row.contentId);
    return (
      <OfflineContentRow
        key={row.id}
        title={info.title}
        typeLabel={info.type}
        image={info.image}
        state={row.state}
        savedLabel={row.downloadedAt && !isChild ? `${info.type} · ${t('offline.v2.saved', { date: formatShortDate(localDateKey(new Date(row.downloadedAt)), language) })}` : info.type}
        large={isChild}
        compact={compact}
        onOpen={() => router.push(row.route as never)}
        onRemove={row.state === 'failed' ? () => useOfflineStore.getState().remove(row.id) : () => setConfirmOne({ id: row.id, title: info.title })}
        onRetry={() => retry(row)}
      />
    );
  }

  const empty = view.availableCount === 0 && view.downloading.length === 0 && view.needsAttention.length === 0;
  const size = formatBytes(bytes, t('offline.v2.units', { returnObjects: true }) as { b: string; kb: string; mb: string });

  return (
    <View style={styles.root}>
      <LibraryHeader title={t('offline.library.title')} subtitle={t('offline.v2.subtitle')} onPressBack={onPressBack} />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]} showsVerticalScrollIndicator={false}>
        {isOffline ? (
          <View style={styles.offlineNote} accessibilityLiveRegion="polite">
            <CloudOff size={16} color={colors.textSecondary} strokeWidth={2.25} />
            <Text style={styles.offlineNoteText}>{t('offline.v2.offlineNow')}</Text>
          </View>
        ) : null}

        {empty ? (
          <>
            <LibraryEmptyState icon={ArrowDownToLine} tone={colors.primary} title={t('offline.v2.emptyTitle')} description={t('offline.v2.emptyBody')} />
            <View style={styles.center}>
              <Button label={t('offline.v2.explore')} variant="secondary" onPress={() => router.push('/explore' as never)} />
            </View>
          </>
        ) : (
          <>
            {/* Summary: real count + measured stored size (never estimated). */}
            <View style={styles.summary} accessible accessibilityLabel={`${t('offline.v2.itemCount', { count: view.availableCount })}${size ? `. ${t('offline.library.storage', { size })}` : ''}`}>
              <View style={styles.summaryIcon}>
                <HardDrive size={18} color={colors.primary} strokeWidth={2} />
              </View>
              <View style={styles.summaryText}>
                <Text style={styles.summaryTitle}>{t('offline.v2.itemCount', { count: view.availableCount })}</Text>
                {size ? <Text style={styles.summaryMeta}>{t('offline.library.storage', { size })}</Text> : null}
                {isAdult && size ? <Text style={styles.summaryNote}>{t('offline.v2.measuredNote')}</Text> : null}
              </View>
            </View>

            {view.downloading.length > 0 ? (
              <View style={styles.section}>
                <SectionHeader title={t('offline.v2.downloading')} size="sm" inset={0} />
                {view.downloading.map((row) => renderRow(row, true))}
                <Text style={styles.hint}>{t('offline.v2.appOpenNote')}</Text>
              </View>
            ) : null}

            {view.needsAttention.length > 0 ? (
              <View style={styles.section}>
                <SectionHeader title={t('offline.v2.needsAttention')} size="sm" inset={0} />
                {view.needsAttention.map((row) => renderRow(row, true))}
              </View>
            ) : null}

            {view.groups.map((group) => (
              <View key={group.id} style={styles.section}>
                <SectionHeader title={t(`offline.library.${group.id}`)} count={group.rows.length} size="sm" inset={0} />
                {group.rows.map((row) => renderRow(row))}
              </View>
            ))}
          </>
        )}

        {/* One short, accurate explanation - no tutorial. */}
        <View style={styles.info}>
          <Info size={16} color={colors.primary} strokeWidth={2.25} />
          <View style={styles.infoText}>
            <Text style={styles.infoTitle}>{t('offline.v2.infoTitle')}</Text>
            <Text style={styles.infoBody}>{t('offline.v2.infoBody')}</Text>
          </View>
        </View>

        {view.availableCount > 0 ? (
          <View style={styles.center}>
            <Button label={t('offline.removeAll')} variant="destructive" size="sm" onPress={() => setConfirmAll(true)} />
          </View>
        ) : null}
      </ScrollView>

      <ConfirmationModal
        visible={!!confirmOne}
        title={t('offline.v2.removeOneTitle')}
        message={t('offline.v2.removeOneMessage')}
        confirmLabel={t('offline.remove')}
        cancelLabel={t('common.cancel')}
        destructive
        onCancel={() => setConfirmOne(null)}
        onConfirm={() => {
          const target = confirmOne;
          setConfirmOne(null);
          if (target) void remove(target.id);
        }}
      />
      <ConfirmationModal
        visible={confirmAll}
        title={t('offline.removeAllConfirmTitle')}
        message={t('offline.removeAllConfirmMessage')}
        confirmLabel={t('offline.removeAll')}
        cancelLabel={t('common.cancel')}
        destructive
        onCancel={() => setConfirmAll(false)}
        onConfirm={() => {
          setConfirmAll(false);
          void useOfflineStore
            .getState()
            .removeAll()
            .then(() => showToast(t('offline.v2.removed')));
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.md, gap: spacing.lg, paddingTop: spacing.xs },
  offlineNote: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, padding: spacing.sm, borderRadius: cardRadii.chip, backgroundColor: colors.surfaceMuted },
  offlineNoteText: { ...textStyles.caption, color: colors.textSecondary, flex: 1 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: cardRadii.media, backgroundColor: colors.surfaceElevated },
  summaryIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
  summaryText: { flex: 1, gap: 2 },
  summaryTitle: { ...textStyles.title, color: colors.textPrimary },
  summaryMeta: { ...textStyles.caption, color: colors.textSecondary },
  summaryNote: { ...textStyles.small, color: colors.textMuted },
  section: { gap: spacing.xs },
  hint: { ...textStyles.small, color: colors.textMuted },
  info: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceMuted },
  infoText: { flex: 1, gap: 3 },
  infoTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  infoBody: { ...textStyles.caption, fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  center: { alignItems: 'center' },
});
