import { LinearGradient } from 'expo-linear-gradient';
import { Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable, Skeleton } from '@/components/ui';
import { cultureCategoryImages } from '@/features/culture/data';
import type { CultureCategoryId } from '@/features/culture/types';
import type { TodayDiscovery } from '@/features/daily/useTodayDiscovery';
import type { AgeExperience } from '@/services/ageExperience/types';
import { colors, fontFamily, radii, spacing, typography } from '@/theme';

import { HOME_RADIUS, HomeArtwork, HomePrimaryPill } from './homeKit';

type TodayDiscoveryEntryCardProps = {
  discovery: TodayDiscovery | null;
  isLoading: boolean;
  experience: AgeExperience;
  onPress: () => void;
};

/**
 * Daily OYNO on Home - a full-width editorial card: artwork backdrop with a
 * dark readable overlay, a clear "TODAY" label, the item's real title,
 * honest read-time + category, and one gold Open CTA (or a quiet "done"
 * once completed - no streak pressure). Small source art (e.g. a 150 px
 * ornament motif) is never stretched: HomeArtwork uses the same category's
 * high-resolution photograph full-bleed instead.
 */
export function TodayDiscoveryEntryCard({ discovery, isLoading, experience, onPress }: TodayDiscoveryEntryCardProps) {
  const { t } = useTranslation();

  if (isLoading) return <Skeleton height={340} borderRadius={HOME_RADIUS.hero} />;
  if (!discovery) return null;

  const meta = [t('daily.minutes', { count: discovery.minutes }), discovery.categoryTitle].filter(Boolean).join(' · ');
  const backdrop = cultureCategoryImages[discovery.item.category_id as CultureCategoryId] ?? null;

  return (
    <AnimatedPressable
      style={[styles.card, experience === 'child' && styles.cardChild]}
      onPress={onPress}
      pressScale={0.98}
      hoverEffect
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={`${t('daily.entry.overline')}. ${discovery.item.title}. ${meta}. ${discovery.isCompleted ? t('daily.entry.done') : t('daily.entry.open')}`}
    >
      <HomeArtwork source={discovery.imageSource} backdrop={backdrop} />
      <LinearGradient colors={['rgba(19,32,24,0.35)', 'rgba(19,32,24,0.1)', 'rgba(19,32,24,0.92)']} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} />

      <View style={styles.today}>
        <OymoOrnament size={10} color={colors.accentGold} strokeWidth={1.75} />
        <Text style={styles.todayText}>{t('daily.entry.overline')}</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.kicker}>{t('daily.entry.title')}</Text>
        <Text style={[styles.title, experience === 'adult' && styles.titleEditorial]} numberOfLines={2}>
          {discovery.item.title}
        </Text>
        {experience !== 'child' ? (
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
        <View style={styles.ctaRow}>
          {discovery.isCompleted ? (
            <View style={styles.done}>
              <Check size={14} color={colors.accentGold} strokeWidth={3} />
              <Text style={styles.doneText}>{t('daily.entry.done')}</Text>
            </View>
          ) : (
            <HomePrimaryPill label={t('daily.entry.open')} large={experience === 'child'} />
          )}
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', minHeight: 340, borderRadius: HOME_RADIUS.hero, overflow: 'hidden', justifyContent: 'space-between', backgroundColor: colors.surfaceFeature },
  cardChild: { minHeight: 380 },
  today: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, margin: spacing.lg, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radii.pill, backgroundColor: 'rgba(19,32,24,0.62)' },
  todayText: { ...typography.overline, color: colors.accentGold },
  body: { padding: spacing.lg, gap: 4 },
  kicker: { ...typography.body, fontSize: 15, fontWeight: '600', color: 'rgba(251,243,227,0.82)' },
  title: { ...typography.display, fontSize: 32, lineHeight: 38, color: colors.textOnDark },
  titleEditorial: { fontFamily: fontFamily.wordmark },
  meta: { ...typography.body, fontSize: 14, color: 'rgba(251,243,227,0.78)' },
  ctaRow: { marginTop: spacing.md },
  done: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, minHeight: 50, paddingHorizontal: spacing.md, borderRadius: radii.pill, backgroundColor: 'rgba(232,185,61,0.16)' },
  doneText: { ...typography.bodyBold, color: colors.accentGold },
});
