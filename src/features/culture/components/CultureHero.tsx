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
          colors={['rgba(20,14,8,0.92)', 'rgba(20,14,8,0.55)', 'rgba(20,14,8,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.ornamentBadge}>
          <OymoOrnament size={13} color={colors.accentGold} strokeWidth={1.5} />
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>{t('culture.hero.title')}</Text>
          <Text style={styles.description}>{t('culture.hero.description')}</Text>

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
    aspectRatio: 1.65,
    borderRadius: radii.xl,
    overflow: 'hidden',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(232,185,61,0.45)',
  },
  ornamentBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(43,32,25,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
    maxWidth: '68%',
  },
  title: {
    ...typography.display,
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
