import { router } from 'expo-router';
import { ArrowDownToLine, HardDrive } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type ImageSourcePropType, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LibraryEmptyState, LibraryHeader, LibrarySectionHeader } from '@/components/library/LibraryChrome';
import { LibraryContentRow } from '@/components/library/LibraryContentRow';
import { AnimatedPressable, ConfirmationModal } from '@/components/ui';
import { getCollection } from '@/features/collections/collectionsData';
import { cultureItemImages } from '@/features/culture/data';
import { natureSiteImages } from '@/features/explore/data';
import type { SupportedLanguage } from '@/i18n';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
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
  const { experience } = useAgeExperience();
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

  const typeFor = (kind: OfflineKind): 'nature' | 'collection' | 'culture_item' => kind;

  return (
    <View style={styles.root}>
      <LibraryHeader title={t('offline.library.title')} subtitle={t('library.offlineSubtitle')} onPressBack={onPressBack} />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]} showsVerticalScrollIndicator={false}>
        {entries.length === 0 ? (
          <LibraryEmptyState icon={ArrowDownToLine} tone={colors.primary} title={t('offline.library.emptyTitle')} description={t('offline.library.emptyDescription')} />
        ) : (
          <>
            <View style={styles.summary} accessible accessibilityLabel={`${t('offline.library.count', { count: entries.length })}${bytes !== null ? `, ${t('offline.library.storage', { size: formatBytes(bytes) })}` : ''}`}>
              <View style={styles.summaryIcon}>
                <HardDrive size={18} color={colors.primary} strokeWidth={2} />
              </View>
              <View style={styles.summaryTextBlock}>
                <Text style={styles.summaryText}>{t('offline.library.count', { count: entries.length })}</Text>
                {bytes !== null ? <Text style={styles.summarySize}>{t('offline.library.storage', { size: formatBytes(bytes) })}</Text> : null}
              </View>
            </View>
            <Text style={styles.summaryNote}>{t('offline.library.storageNote')}</Text>

            {SECTIONS.map(({ kind, titleKey }) => {
              const sectionEntries = entries.filter((entry) => entry.kind === kind);
              if (sectionEntries.length === 0) return null;
              return (
                <View key={kind} style={styles.section}>
                  <LibrarySectionHeader title={t(titleKey)} count={sectionEntries.length} />
                  <View style={styles.list}>
                    {sectionEntries.map((entry) => {
                      const { title, image } = describe(entry);
                      return (
                        <LibraryContentRow
                          key={entry.id}
                          item={{ contentType: typeFor(entry.kind), id: entry.contentId, title, thumbnail: image }}
                          experience={experience}
                          offline
                          onPress={() => router.push(routeFor(entry) as never)}
                          trailing={
                            <AnimatedPressable
                              style={styles.remove}
                              onPress={() => void useOfflineStore.getState().remove(entry.id)}
                              accessibilityRole="button"
                              accessibilityLabel={t('offline.a11y.remove', { title })}
                            >
                              <Text style={styles.removeText}>{t('offline.remove')}</Text>
                            </AnimatedPressable>
                          }
                        />
                      );
                    })}
                  </View>
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
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.md, gap: spacing.md, paddingTop: spacing.xs },
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radii.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder },
  summaryIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt },
  summaryTextBlock: { flex: 1, gap: 2 },
  summaryText: { ...typography.bodyBold, color: colors.textPrimary },
  summarySize: { ...typography.caption, color: colors.textSecondary },
  summaryNote: { ...typography.small, fontWeight: '500', color: colors.textMuted, marginTop: -spacing.xs },
  section: { gap: spacing.xs },
  list: { gap: spacing.xxs },
  remove: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.xs },
  removeText: { ...typography.caption, fontWeight: '600', color: colors.textSecondary, textDecorationLine: 'underline' },
  removeAll: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md },
  removeAllText: { ...typography.bodyBold, color: colors.danger },
});
