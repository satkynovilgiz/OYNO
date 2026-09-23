import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable } from '@/components/ui';
import { LOCATION_TONES } from '@/features/explore/data';
import { useReducedMotion } from '@/services/motion/useReducedMotion';
import { colors, fontFamily, spacing, typography } from '@/theme';

import type { PassportStamp as PassportStampData } from '../passport';

type PassportStampProps = {
  stamp: PassportStampData;
  size: number;
  /** Already-formatted visit date, or null when no real date is known. */
  dateLabel: string | null;
  /** Journal style (adult): serif name. */
  editorial?: boolean;
  /** True only the first time this stamp is seen unlocked - plays the
   * one-time "pressed into the passport" motion and haptic. */
  celebrate?: boolean;
  /** Distinct fixed tilt per stamp so a page reads as hand-stamped. */
  tilt: string;
  onPress: () => void;
};

/**
 * A Discovery Passport seal. Unlocked: the destination's own photo inside a
 * ring in that destination's tone (the same tone its Explore card and
 * detail hero use), a fine gold inner ring, and an oymo diamond at each
 * compass point - a travel-document seal, not an app icon. Locked: a faint
 * dashed outline with a single ghosted oymo and the name still readable,
 * so the page shows where there is left to go.
 */
export function PassportStamp({ stamp, size, dateLabel, editorial = false, celebrate = false, tilt, onPress }: PassportStampProps) {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(celebrate && !reducedMotion ? 1.35 : 1);
  const opacity = useSharedValue(celebrate && !reducedMotion ? 0 : 1);

  useEffect(() => {
    if (!celebrate) return;
    if (!reducedMotion) {
      opacity.value = withDelay(250, withTiming(1, { duration: 200 }));
      scale.value = withDelay(250, withSpring(1, { damping: 11, stiffness: 180 }));
    }
    const timer = setTimeout(() => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [celebrate]);

  const sealStyle = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));

  const tone = LOCATION_TONES[stamp.toneIndex % LOCATION_TONES.length];
  const photo = size - 22;

  return (
    <AnimatedPressable
      style={styles.wrap}
      onPress={onPress}
      hoverEffect
      accessibilityRole="button"
      accessibilityLabel={dateLabel ? `${stamp.title}, ${dateLabel}` : stamp.title}
      accessibilityState={{ selected: stamp.unlocked }}
    >
      {stamp.unlocked ? (
        <Animated.View style={[{ width: size, height: size, transform: [{ rotate: tilt }] }, sealStyle]}>
          <View style={[styles.sealOuter, { width: size, height: size, borderRadius: size / 2, backgroundColor: tone }]}>
            <View style={[styles.sealGoldRing, { width: size - 10, height: size - 10, borderRadius: (size - 10) / 2 }]}>
              <View style={[styles.photo, { width: photo, height: photo, borderRadius: photo / 2 }]}>
                {stamp.imageSource ? (
                  <Image source={stamp.imageSource} style={styles.photoImage} resizeMode="cover" />
                ) : (
                  <OymoOrnament size={photo * 0.4} color={colors.accentGold} strokeWidth={1.5} />
                )}
              </View>
            </View>
          </View>
          {(['top', 'bottom', 'left', 'right'] as const).map((edge) => (
            <View key={edge} style={[styles.compass, compassPosition(edge, size), { backgroundColor: tone }]}>
              <OymoOrnament size={9} color={colors.accentGold} strokeWidth={2} />
            </View>
          ))}
        </Animated.View>
      ) : (
        <View style={[styles.locked, { width: size, height: size, borderRadius: size / 2 }]}>
          <View style={[styles.lockedInner, { width: size - 14, height: size - 14, borderRadius: (size - 14) / 2 }]}>
            <OymoOrnament size={size * 0.28} color={colors.border} strokeWidth={1.25} />
          </View>
        </View>
      )}

      <Text style={[styles.name, editorial && styles.nameEditorial, !stamp.unlocked && styles.nameLocked]} numberOfLines={2}>
        {stamp.title}
      </Text>
      {stamp.unlocked && dateLabel ? <Text style={styles.date}>{dateLabel}</Text> : null}
    </AnimatedPressable>
  );
}

function compassPosition(edge: 'top' | 'bottom' | 'left' | 'right', size: number) {
  const half = size / 2 - 8;
  if (edge === 'top') return { top: -6, left: half };
  if (edge === 'bottom') return { bottom: -6, left: half };
  if (edge === 'left') return { left: -6, top: half };
  return { right: -6, top: half };
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  sealOuter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealGoldRing: {
    borderWidth: 1.5,
    borderColor: colors.accentGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceFeature,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  compass: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locked: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedInner: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  nameEditorial: {
    fontFamily: fontFamily.wordmark,
  },
  nameLocked: {
    color: colors.textMuted,
    fontWeight: '600',
  },
  date: {
    ...typography.small,
    color: colors.accentTerracotta,
    letterSpacing: 0.4,
  },
});
