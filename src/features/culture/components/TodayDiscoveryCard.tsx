import { ArrowRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable, Badge } from '@/components/ui';
import { colors, radii, shadows, spacing, typography } from '@/theme';

import type { CultureDiscovery } from '../types';

type TodayDiscoveryCardProps = {
  discovery: CultureDiscovery;
  onPress?: () => void;
};

export function TodayDiscoveryCard({ discovery, onPress }: TodayDiscoveryCardProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.label}>{t('culture.discovery.label')}</Text>
        {discovery.isNew && <Badge label={t('culture.discovery.newBadge')} color={colors.accentGold} textColor={colors.textPrimary} />}
      </View>

      <View style={styles.body}>
        <Image source={discovery.imageSource} style={styles.image} resizeMode="contain" />

        <View style={styles.textBlock}>
          <Text style={styles.title}>{discovery.title}</Text>
          <Text style={styles.description} numberOfLines={3}>
            {discovery.description}
          </Text>

          <AnimatedPressable
            style={styles.cta}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={t('culture.discovery.cta')}
          >
            <Text style={styles.ctaLabel}>{t('culture.discovery.cta')}</Text>
            <ArrowRight size={14} color={colors.textOnPrimary} strokeWidth={2.5} />
          </AnimatedPressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.sm,
    gap: spacing.xs,
    ...shadows.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    ...typography.overline,
    color: colors.textSecondary,
  },
  body: {
    flex: 1,
    gap: spacing.xs,
  },
  image: {
    width: '100%',
    height: 64,
  },
  textBlock: {
    gap: 2,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  description: {
    ...typography.small,
    color: colors.textSecondary,
    lineHeight: 15,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xxs,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    marginTop: spacing.xxs,
  },
  ctaLabel: {
    ...typography.caption,
    color: colors.textOnPrimary,
    fontWeight: '700',
  },
});
