import { router } from 'expo-router';
import { BookOpen, Check } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import { AnimatedPressable, Button, ProgressBar, SectionHeader } from '@/components/ui';
import { cultureItemImages, cultureMaterialImages } from '@/features/culture/data';
import { useRecordsOwner } from '@/features/games/records/useGameRecords';
import type { AgeExperience } from '@/services/ageExperience/types';
import { useAllCultureItems } from '@/services/content/cultureItemsService';
import { useCultureMaterials } from '@/services/content/cultureService';
import { ownerReading, useReadingStore } from '@/store/useReadingStore';
import { cardRadii, colors, editorial, spacing, textStyles } from '@/theme';

import { continueReading, percentRead, recentlyRead, type ReadingProgress } from './readingModel';

const RECENT_SHOWN = 5;

type Resolved = { record: ReadingProgress; title: string; route: string; image: ImageSourcePropType | null; typeKey: string };

/**
 * Culture: ONE "Continue reading" card (the most recent unfinished
 * article) and a short "Recently read" list. Private, on this device.
 * Content that no longer exists is skipped, never shown broken.
 */
export function ContinueReadingSection({ experience }: { experience: AgeExperience }) {
  const { t } = useTranslation();
  const owner = useRecordsOwner();
  const data = ownerReading(useReadingStore((state) => state.saved), owner);
  const { data: items } = useAllCultureItems();
  const { data: materials } = useCultureMaterials();
  const isChild = experience === 'child';

  useEffect(() => {
    void useReadingStore.getState().load();
  }, []);

  const resolve = (record: ReadingProgress): Resolved | null => {
    if (record.contentType === 'culture_item') {
      const item = items?.find((row) => row.id === record.contentId);
      return item ? { record, title: item.title, route: `/culture/item/${item.id}`, image: item.image_url ? { uri: item.image_url } : (cultureItemImages[item.id]?.[0] ?? null), typeKey: 'library.types.culture' } : null;
    }
    const material = materials?.find((row) => row.id === record.contentId);
    return material ? { record, title: material.title, route: `/culture/material/${material.id}`, image: cultureMaterialImages[material.id] ?? null, typeKey: 'library.types.material' } : null;
  };
  const exists = (record: ReadingProgress) => resolve(record) !== null;

  const current = continueReading(data, exists);
  const currentResolved = current ? resolve(current) : null;
  const recent = recentlyRead(data, exists)
    .filter((record) => record !== current)
    .slice(0, RECENT_SHOWN)
    .map(resolve)
    .filter((entry): entry is Resolved => !!entry);

  if (!currentResolved && recent.length === 0) return null;

  return (
    <View style={styles.section}>
      {currentResolved ? (
        <View style={styles.card} accessible={false}>
          <Text style={styles.kicker}>{t('reading.continueReading')}</Text>
          <View style={styles.cardRow}>
            {currentResolved.image ? <Image source={currentResolved.image} style={styles.thumb} resizeMode="cover" /> : <View style={[styles.thumb, styles.thumbFallback]} />}
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[styles.title, experience === 'adult' && styles.titleEditorial]} numberOfLines={2}>
                {currentResolved.title}
              </Text>
              <Text style={styles.meta}>{t('reading.percentRead', { percent: percentRead(currentResolved.record) })}</Text>
              <View accessible accessibilityRole="progressbar" accessibilityLabel={t('reading.progress')} accessibilityValue={{ min: 0, max: 100, now: percentRead(currentResolved.record) }} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentRead(currentResolved.record)}>
                <ProgressBar progress={currentResolved.record.furthest} height={isChild ? 8 : 4} fillColor={colors.accentGold} trackColor={colors.surfaceMuted} />
              </View>
            </View>
          </View>
          <Button label={t('reading.continue')} size="sm" onPress={() => router.push(currentResolved.route as never)} />
        </View>
      ) : null}

      {recent.length > 0 && !isChild ? (
        <View style={{ gap: spacing.xs }}>
          <SectionHeader title={t('reading.recentlyRead')} size="sm" inset={0} />
          {recent.map((entry) => {
            const done = !!entry.record.completedAt;
            const state = done ? t('reading.completed') : t('reading.percentRead', { percent: percentRead(entry.record) });
            return (
              <AnimatedPressable
                key={`${entry.record.contentType}:${entry.record.contentId}`}
                style={styles.row}
                onPress={() => router.push(entry.route as never)}
                press="soft"
                accessibilityRole="button"
                accessibilityLabel={`${entry.title}. ${t(entry.typeKey)}. ${state}.`}
              >
                <View style={styles.rowIcon}>{done ? <Check size={14} color={colors.primary} strokeWidth={2.5} /> : <BookOpen size={14} color={colors.textSecondary} strokeWidth={2} />}</View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {entry.title}
                  </Text>
                  <Text style={styles.meta}>
                    {t(entry.typeKey)} · {state}
                  </Text>
                </View>
              </AnimatedPressable>
            );
          })}
          <Text style={styles.note}>{t('reading.onThisDevice')}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md, paddingHorizontal: spacing.md },
  card: { gap: spacing.sm, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  kicker: { ...textStyles.overline, color: colors.accentTerracotta },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  thumb: { width: 56, height: 56, borderRadius: 12 },
  thumbFallback: { backgroundColor: colors.surfaceFeature },
  title: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  titleEditorial: { ...editorial(textStyles.bodyMedium) },
  meta: { ...textStyles.small, color: colors.textSecondary },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48 },
  rowIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
  rowTitle: { ...textStyles.bodyMedium, fontWeight: '600', color: colors.textPrimary },
  note: { ...textStyles.small, color: colors.textMuted },
});
