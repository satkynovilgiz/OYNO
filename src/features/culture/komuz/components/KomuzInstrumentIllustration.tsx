import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { colors, radii } from '@/theme';

const ILLUSTRATION_WIDTH = 160;
const ILLUSTRATION_HEIGHT = 220;
const NECK_TOP = 10;
const NECK_BOTTOM = 130;
const STRING_X_POSITIONS = [64, 80, 96];

/**
 * Original SVG komuz shape (not a reproduction of any specific
 * instrument's exact proportions) - a long neck over a rounded resonator
 * body, matching the real 3-string, wood-carved construction described in
 * the sourced `komuz-overview` content. No licensed pluck-sound audio
 * exists (same flag as V1), so tapping a string animates a brief visual
 * wobble instead of playing a sound.
 */
export function KomuzInstrumentIllustration() {
  const { t } = useTranslation();

  return (
    <View style={styles.wrap}>
      <Svg width={ILLUSTRATION_WIDTH} height={ILLUSTRATION_HEIGHT} viewBox={`0 0 ${ILLUSTRATION_WIDTH} ${ILLUSTRATION_HEIGHT}`}>
        <Path
          d="M70 4 L90 4 L86 130 L74 130 Z"
          fill={colors.accentBrown}
          stroke={colors.accentBrownDark}
          strokeWidth={2}
        />
        <Path
          d="M80 118 C40 118 20 150 20 178 C20 205 46 216 80 216 C114 216 140 205 140 178 C140 150 120 118 80 118 Z"
          fill={colors.accentBrown}
          stroke={colors.accentBrownDark}
          strokeWidth={2}
        />
        <Path d="M80 118 C60 118 50 130 50 145 C50 160 63 168 80 168 C97 168 110 160 110 145 C110 130 100 118 80 118 Z" fill={colors.accentBrownDark} opacity={0.3} />
      </Svg>

      {STRING_X_POSITIONS.map((x, index) => (
        <KomuzString key={index} x={x} label={t('culture.komuz.strings.stringLabel', { index: index + 1 })} />
      ))}
    </View>
  );
}

function KomuzString({ x, label }: { x: number; label: string }) {
  const wobble = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${wobble.value}deg` }],
  }));

  function handlePress() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    wobble.value = withSequence(
      withTiming(-5, { duration: 60 }),
      withTiming(5, { duration: 90 }),
      withTiming(-3, { duration: 90 }),
      withTiming(0, { duration: 90 }),
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      style={[styles.stringHitArea, { left: x - 12 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
    >
      <Animated.View style={[styles.string, animatedStyle]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: ILLUSTRATION_WIDTH,
    height: ILLUSTRATION_HEIGHT,
    alignSelf: 'center',
  },
  stringHitArea: {
    position: 'absolute',
    top: NECK_TOP,
    width: 24,
    height: NECK_BOTTOM - NECK_TOP,
    alignItems: 'center',
  },
  string: {
    width: 2,
    height: NECK_BOTTOM - NECK_TOP,
    borderRadius: radii.sm,
    backgroundColor: colors.accentGold,
  },
});
