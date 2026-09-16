import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable, FadeSlideIn } from '@/components/ui';
import { colors, radii, shadows, spacing, typography } from '@/theme';
import heroArt from '@assets/img/OYNO_design/culture/culture_hero.png';

type CultureHeroProps = {
  onPress?: () => void;
};

export function CultureHero({ onPress }: CultureHeroProps) {
  const { t } = useTranslation();

  return (
    // Shadow lives on this wrapper, not the clipped/overflow:hidden card
    // itself - a view drops its own shadow on iOS once it also clips
    // content via overflow (same fix as Explore's KyrgyzstanMap.tsx).
    <FadeSlideIn style={shadows.card}>
      <View style={styles.card}>
        <Image source={heroArt} style={[StyleSheet.absoluteFill, styles.image]} resizeMode="cover" />
        <LinearGradient
          colors={['rgba(19,32,24,0)', 'rgba(19,32,24,0.35)', 'rgba(19,32,24,0.92)']}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.content}>
          <View style={styles.ornamentRow}>
            <OymoOrnament size={12} color={colors.accentGold} strokeWidth={1.5} />
            <Text style={styles.eyebrow}>{t('culture.title')}</Text>
          </View>
          <Text style={styles.title}>{t('culture.hero.title')}</Text>
          <Text style={styles.description} numberOfLines={2}>
            {t('culture.hero.description')}
          </Text>

          <AnimatedPressable style={styles.cta} onPress={onPress} hoverEffect accessibilityRole="button" accessibilityLabel={t('culture.hero.cta')}>
            <Text style={styles.ctaLabel}>{t('culture.hero.cta')}</Text>
            <ArrowRight size={16} color={colors.textPrimary} strokeWidth={2.5} />
          </AnimatedPressable>
        </View>
      </View>
    </FadeSlideIn>
  );
}

const styles = StyleSheet.create({
  card: {
    aspectRatio: 1.15,
    borderRadius: radii.xxl,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  content: {
    padding: spacing.lg,
    gap: spacing.xs,
  },
  ornamentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  eyebrow: {
    ...typography.overline,
    color: colors.accentGold,
  },
  title: {
    ...typography.display,
    fontSize: 28,
    color: colors.textOnDark,
  },
  description: {
    ...typography.body,
    color: colors.textOnDark,
    opacity: 0.9,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xxs,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    marginTop: spacing.xs,
  },
  ctaLabel: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '700',
  },
});
