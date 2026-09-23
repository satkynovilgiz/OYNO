import { ArrowRight, Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable, Skeleton } from '@/components/ui';
import type { TodayDiscovery } from '@/features/daily/useTodayDiscovery';
import { colors, radii, spacing, typography } from '@/theme';

type TodayDiscoveryEntryCardProps = {
  discovery: TodayDiscovery | null;
  isLoading: boolean;
  onPress: () => void;
};

/**
 * Home's compact "Today" entry point into Daily OYNO (spec "HOME: Create a
 * compact premium 'Today' entry point") - artwork, the item's real title,
 * an honest read-time + category line, and one CTA. Once today's
 * discovery is done it quietly says so instead of nagging; there's no
 * countdown or streak pressure here. Renders nothing if there's genuinely
 * no eligible content (rather than a fake placeholder card).
 */
export function TodayDiscoveryEntryCard({ discovery, isLoading, onPress }: TodayDiscoveryEntryCardProps) {
  const { t } = useTranslation();

  if (isLoading) return <Skeleton height={112} borderRadius={radii.xl} />;
  if (!discovery) return null;

  const meta = [t('daily.minutes', { count: discovery.minutes }), discovery.categoryTitle].filter(Boolean).join(' • ');

  return (
    <AnimatedPressable
      style={styles.card}
      onPress={onPress}
      pressScale={0.98}
      hoverEffect
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={`${t('daily.entry.title')}: ${discovery.item.title}`}
    >
      <Image source={discovery.imageSource} style={styles.artwork} resizeMode="cover" />

      <View style={styles.body}>
        <View style={styles.overlineRow}>
          <OymoOrnament size={10} color={colors.accentGold} strokeWidth={1.75} />
          <Text style={styles.overline}>{t('daily.entry.overline')}</Text>
        </View>
        <Text style={styles.subtitle}>{t('daily.entry.title')}</Text>
        <Text style={styles.title} numberOfLines={1}>
          {discovery.item.title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {meta}
        </Text>

        {discovery.isCompleted ? (
          <View style={[styles.cta, styles.ctaDone]}>
            <Check size={13} color={colors.accentGold} strokeWidth={3} />
            <Text style={[styles.ctaLabel, styles.ctaLabelDone]}>{t('daily.entry.done')}</Text>
          </View>
        ) : (
          <View style={styles.cta}>
            <Text style={styles.ctaLabel}>{t('daily.entry.open')}</Text>
            <ArrowRight size={13} color={colors.textPrimary} strokeWidth={2.5} />
          </View>
        )}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceFeature,
    borderRadius: radii.xl,
    overflow: 'hidden',
    minHeight: 132,
  },
  artwork: {
    width: '36%',
    minHeight: 132,
    height: '100%',
    backgroundColor: colors.surfaceAlt,
  },
  body: {
    flex: 1,
    padding: spacing.md,
    gap: 2,
    justifyContent: 'center',
  },
  overlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  overline: {
    ...typography.overline,
    color: colors.accentGold,
  },
  subtitle: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.7)',
  },
  title: {
    ...typography.h1,
    color: colors.textOnDark,
    marginTop: spacing.xxs,
  },
  meta: {
    ...typography.small,
    color: 'rgba(255,255,255,0.7)',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xxs,
    backgroundColor: colors.accentGold,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.pill,
    marginTop: spacing.xs,
  },
  ctaDone: {
    backgroundColor: 'rgba(232,185,61,0.14)',
  },
  ctaLabel: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  ctaLabelDone: {
    color: colors.accentGold,
  },
});
