import { router } from 'expo-router';
import { ArrowDownToLine, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, type ImageSourcePropType, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, ConfirmationModal, EmptyState, IconButton } from '@/components/ui';
import { getCollection } from '@/features/collections/collectionsData';
import { cultureItemImages } from '@/features/culture/data';
import { natureSiteImages } from '@/features/explore/data';
import type { SupportedLanguage } from '@/i18n';
import { useAllCultureItems } from '@/services/content/cultureItemsService';
import { useExploreRegions } from '@/services/content/exploreService';
import { mapExploreRegionName } from '@/services/content/types';
import type { OfflineKind, OfflineManifestEntry } from '@/services/offline/offlineManifest';
import { useOfflineStore } from '@/services/offline/useOfflineStore';
import { colors, radii, spacing, typography } from '@/theme';

const SECTIONS: { kind: OfflineKind; titleKey: string }[] = [
  { kind: 'nature', titleKey: 'offline.library.places' },
  { kind: 'collection', titleKey: 'offline.library.collections' },
  { kind: 'culture_item', titleKey: 'offline.library.culture' },
];

function routeFor(entry: OfflineManifestEntry): string {
  if (entry.kind === 'nature') return `/explore/${entry.contentId}`;
  if (entry.kind === 'collection') return `/collections/${entry.contentId}`;
  return `/culture/item/${entry.contentId}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Offline Downloads - every downloaded place/collection/culture item,
 * each opening its EXISTING detail screen. Shows the real count and the
 * measured size of the stored text data (bundled photos are part of the
 * app and are never copied, so they aren't counted). Removing only
 * deletes offline copies - never favorites, progress, Passport stamps,
 * Journey or achievements.
 */
export function OfflineDownloadsScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const insets = useSafeAreaInsets();
  const manifest = useOfflineStore((state) => state.manifest);
  const entries = Object.values(manifest.entries);
  const { data: regions } = useExploreRegions();
  const { data: cultureItems } = useAllCultureItems();
  const [bytes, setBytes] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void useOfflineStore
      .getState()
      .measureBytes()
      .then((value) => {
        if (!cancelled) setBytes(value);
      });
    return () => {
      cancelled = true;
    };
  }, [manifest]);

  function describe(entry: OfflineManifestEntry): { title: string; image: ImageSourcePropType | null } {
    if (entry.kind === 'nature') {
      const row = regions?.find((region) => region.id === entry.contentId);
      const name = row ? mapExploreRegionName(row) : null;
      return { title: name ? (name[language] ?? name.kg) : entry.contentId, image: natureSiteImages[entry.contentId] ?? null };
    }
    if (entry.kind === 'collection') {
      const collection = getCollection(entry.contentId);
      return { title: collection ? (collection.title[language] ?? collection.title.kg) : entry.contentId, image: collection?.heroImage ?? null };
    }
    return {
      title: cultureItems?.find((item) => item.id === entry.contentId)?.title ?? entry.contentId,
      image: cultureItemImages[entry.contentId]?.[0] ?? null,
    };
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <Text style={styles.title}>{t('offline.library.title')}</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]} showsVerticalScrollIndicator={false}>
        {entries.length === 0 ? (
          <EmptyState icon={ArrowDownToLine} title={t('offline.library.emptyTitle')} description={t('offline.library.emptyDescription')} />
        ) : (
          <>
            <View style={styles.summary}>
              <Text style={styles.summaryText}>
                {t('offline.library.count', { count: entries.length })}
                {bytes !== null ? ` · ${t('offline.library.storage', { size: formatBytes(bytes) })}` : ''}
              </Text>
              <Text style={styles.summaryNote}>{t('offline.library.storageNote')}</Text>
            </View>

            {SECTIONS.map(({ kind, titleKey }) => {
              const sectionEntries = entries.filter((entry) => entry.kind === kind);
              if (sectionEntries.length === 0) return null;
              return (
                <View key={kind} style={styles.section}>
                  <Text style={styles.sectionTitle}>{t(titleKey)}</Text>
                  {sectionEntries.map((entry) => {
                    const { title, image } = describe(entry);
                    return (
                      <View key={entry.id} style={styles.row}>
                        <AnimatedPressable
                          style={styles.rowMain}
                          onPress={() => router.push(routeFor(entry) as never)}
                          hoverEffect
                          accessibilityRole="button"
                          accessibilityLabel={t('offline.a11y.available', { title })}
                        >
                          {image ? <Image source={image} style={styles.thumb} resizeMode="cover" /> : <View style={styles.thumb} />}
                          <Text style={styles.rowTitle} numberOfLines={2}>
                            {title}
                          </Text>
                          <ChevronRight size={16} color={colors.textMuted} strokeWidth={2} />
                        </AnimatedPressable>
                        <AnimatedPressable
                          style={styles.remove}
                          onPress={() => void useOfflineStore.getState().remove(entry.id)}
                          accessibilityRole="button"
                          accessibilityLabel={t('offline.a11y.remove', { title })}
                        >
                          <Text style={styles.removeText}>{t('offline.remove')}</Text>
                        </AnimatedPressable>
                      </View>
                    );
                  })}
                </View>
              );
            })}

            <AnimatedPressable style={styles.removeAll} onPress={() => setConfirming(true)} accessibilityRole="button" accessibilityLabel={t('offline.removeAll')}>
              <Text style={styles.removeAllText}>{t('offline.removeAll')}</Text>
            </AnimatedPressable>
          </>
        )}
      </ScrollView>

      <ConfirmationModal
        visible={confirming}
        title={t('offline.removeAllConfirmTitle')}
        message={t('offline.removeAllConfirmMessage')}
        confirmLabel={t('offline.removeAll')}
        cancelLabel={t('common.cancel')}
        destructive
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          void useOfflineStore.getState().removeAll();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.md,
    gap: spacing.lg,
  },
  summary: {
    gap: 2,
  },
  summaryText: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  summaryNote: {
    ...typography.small,
    fontWeight: '500',
    color: colors.textMuted,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.overline,
    color: colors.accentTerracotta,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
  },
  rowTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    flex: 1,
  },
  remove: {
    paddingVertical: spacing.xs,
  },
  removeText: {
    ...typography.caption,
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },
  removeAll: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
  },
  removeAllText: {
    ...typography.bodyBold,
    color: colors.danger,
  },
});
