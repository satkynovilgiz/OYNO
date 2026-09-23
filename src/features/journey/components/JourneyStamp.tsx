import { MapPin } from 'lucide-react-native';
import { Image, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';

import type { JourneyStamp as JourneyStampData } from '../journeyData';

type JourneyStampProps = {
  stamp: JourneyStampData;
  size: number;
  /** Small fixed tilt per position so a page of stamps reads as hand-
   * pressed into a passport rather than a grid of avatars. */
  index: number;
  showDetail: boolean;
  onPress?: () => void;
};

const TILTS = ['-5deg', '3deg', '-2deg', '4deg', '-3deg', '2deg'];

/** One passport stamp. Earned: full-color artwork inside a double gold ring.
 * Not yet earned: a faded, dashed-outline "empty slot" - still tappable,
 * so an empty passport page doubles as a map of where to go next rather
 * than a wall of locks. */
export function JourneyStamp({ stamp, size, index, showDetail, onPress }: JourneyStampProps) {
  const inner = size - 10;

  return (
    <AnimatedPressable
      style={[styles.wrap, { width: size + spacing.sm }]}
      onPress={onPress}
      disabled={!onPress}
      hoverEffect
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={stamp.title}
      accessibilityState={{ selected: stamp.earned }}
    >
      <View
        style={[
          styles.ring,
          { width: size, height: size, borderRadius: size / 2, transform: [{ rotate: stamp.earned ? TILTS[index % TILTS.length] : '0deg' }] },
          stamp.earned ? styles.ringEarned : styles.ringEmpty,
        ]}
      >
        <View style={[styles.inner, { width: inner, height: inner, borderRadius: inner / 2 }, !stamp.earned && styles.innerEmpty]}>
          {stamp.imageSource ? (
            <Image source={stamp.imageSource} style={[styles.image, !stamp.earned && styles.imageEmpty]} resizeMode="cover" />
          ) : (
            <MapPin size={inner * 0.38} color={stamp.earned ? colors.accentTerracotta : colors.textMuted} strokeWidth={1.75} />
          )}
        </View>
      </View>
      <Text style={[styles.title, !stamp.earned && styles.titleEmpty]} numberOfLines={2}>
        {stamp.title}
      </Text>
      {showDetail && stamp.detail ? (
        <Text style={styles.detail} numberOfLines={1}>
          {stamp.detail}
        </Text>
      ) : null}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: spacing.xxs,
  },
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  ringEarned: {
    borderColor: colors.accentGold,
    backgroundColor: colors.surface,
  },
  ringEmpty: {
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  inner: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.accentGoldPressed,
  },
  innerEmpty: {
    backgroundColor: colors.surfaceAlt,
    borderColor: 'transparent',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageEmpty: {
    opacity: 0.28,
  },
  title: {
    ...typography.small,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  titleEmpty: {
    color: colors.textMuted,
  },
  detail: {
    ...typography.small,
    fontWeight: '500',
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
