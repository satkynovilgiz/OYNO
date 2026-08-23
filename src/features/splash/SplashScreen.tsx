import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { colors, spacing, typography } from '@/theme';
import wordmark from '@assets/img/OYNO_design/wordmark.png';

type SplashScreenProps = {
  onAnimationComplete: () => void;
};

/** Premium splash (spec Section 11): logo fades in, an Оймо pattern
 * appears beneath it, then hands off to the caller (App root) to decide
 * where to route once auth/onboarding state has loaded. Deliberately
 * short - this isn't the OS-level native splash (expo-splash-screen owns
 * that), it's the branded screen shown while that state resolves. */
export function SplashScreen({ onAnimationComplete }: SplashScreenProps) {
  const { t } = useTranslation();
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.92);
  const taglineOpacity = useSharedValue(0);
  const ornamentOpacity = useSharedValue(0);

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 500 });
    logoScale.value = withTiming(1, { duration: 500 });
    taglineOpacity.value = withDelay(250, withTiming(1, { duration: 400 }));
    ornamentOpacity.value = withDelay(400, withTiming(1, { duration: 500 }));

    const timeout = setTimeout(onAnimationComplete, 1400);
    return () => clearTimeout(timeout);
  }, [logoOpacity, logoScale, taglineOpacity, ornamentOpacity, onAnimationComplete]);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));
  const taglineStyle = useAnimatedStyle(() => ({ opacity: taglineOpacity.value }));
  const ornamentStyle = useAnimatedStyle(() => ({ opacity: ornamentOpacity.value }));

  return (
    <View style={styles.root}>
      <View style={styles.center}>
        <Animated.View style={ornamentStyle}>
          <View style={styles.ornamentRow}>
            <OymoOrnament size={22} color={colors.accentBrown} />
            <OymoOrnament size={22} color={colors.accentBrown} />
            <OymoOrnament size={22} color={colors.accentBrown} />
          </View>
        </Animated.View>

        <Animated.View style={logoStyle}>
          <Image source={wordmark} style={styles.wordmark} resizeMode="contain" />
        </Animated.View>

        <Animated.Text style={[styles.tagline, taglineStyle]}>{t('home.header.tagline')}</Animated.Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    gap: spacing.md,
  },
  ornamentRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  wordmark: {
    width: 220,
    height: 60,
  },
  tagline: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
