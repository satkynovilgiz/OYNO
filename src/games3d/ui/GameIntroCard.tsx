import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { typography } from '@/theme';

type GameIntroCardProps = {
  visible: boolean;
  title: string;
  onDone: () => void;
};

const TITLE_HOLD_MS = 1300;
const START_HOLD_MS = 1100;
/** Exported so the scene's IntroCameraSweep can land its final frame
 * exactly when this card hands off to gameplay. */
export const GAME_INTRO_DURATION_MS = TITLE_HOLD_MS + START_HOLD_MS;

/** Shared ~2-4s title-card intro (Section "COMMON GAME INTRO") shown once
 * per session before the tutorial: a translucent scrim (not opaque) over
 * the already-animating 3D scene - see IntroCameraSweep - so the "camera
 * approaches the game area" beat is actually visible, not hidden behind a
 * black card. Game title fades in, holds, crossfades to "БАШТА!", then
 * auto-continues. Tapping anywhere skips immediately - replays skip this
 * entirely (JaaAtuuController.restart goes straight to READY). */
export function GameIntroCard({ visible, title, onDone }: GameIntroCardProps) {
  const { t } = useTranslation();
  const [showStart, setShowStart] = useState(false);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    setShowStart(false);
    opacity.value = 0;
    opacity.value = withTiming(1, { duration: 220 });

    const toStart = setTimeout(() => {
      opacity.value = withTiming(0, { duration: 150 }, (finished) => {
        if (finished) opacity.value = withTiming(1, { duration: 220 });
      });
      setShowStart(true);
    }, TITLE_HOLD_MS);

    const finish = setTimeout(() => onDone(), GAME_INTRO_DURATION_MS);

    return () => {
      clearTimeout(toStart);
      clearTimeout(finish);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (!visible) return null;

  return (
    <Pressable style={styles.root} onPress={onDone} accessibilityRole="button" accessibilityLabel={t('gameIntro.skip')}>
      <LinearGradient
        colors={['rgba(20,14,8,0.75)', 'rgba(20,14,8,0.2)', 'rgba(20,14,8,0.75)']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Animated.Text style={[styles.text, animatedStyle]}>{showStart ? t('games3d.intro.start') : title}</Animated.Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  text: {
    ...typography.h1,
    fontSize: 34,
    color: '#FFFFFF',
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 8,
  },
});
