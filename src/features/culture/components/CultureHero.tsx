import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { AnimatedPressable } from '@/components/ui';
import { colors, radii, shadows, spacing, typography } from '@/theme';
import heroArt from '@assets/img/OYNO_design/culture/culture_hero.png';

type CultureHeroProps = {
  onPress?: () => void;
};

export function CultureHero({ onPress }: CultureHeroProps) {
  const { t } = useTranslation();
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 450 });
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[styles.card, shadows.card, animatedStyle]}>
      <Image source={heroArt} style={[StyleSheet.absoluteFill, styles.image]} resizeMode="cover" />
      <LinearGradient
        colors={['rgba(20,14,8,0.92)', 'rgba(20,14,8,0.55)', 'rgba(20,14,8,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.content}>
        <Text style={styles.title}>{t('culture.hero.title')}</Text>
        <Text style={styles.description}>{t('culture.hero.description')}</Text>

        <AnimatedPressable style={styles.cta} onPress={onPress} accessibilityRole="button" accessibilityLabel={t('culture.hero.cta')}>
          <Text style={styles.ctaLabel}>{t('culture.hero.cta')}</Text>
          <ArrowRight size={16} color={colors.textPrimary} strokeWidth={2.5} />
        </AnimatedPressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    aspectRatio: 1.65,
    borderRadius: radii.xl,
    overflow: 'hidden',
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
