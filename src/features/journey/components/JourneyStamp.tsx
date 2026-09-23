import { MapPin, type LucideIcon } from 'lucide-react-native';
import { Image, StyleSheet, Text, View } from 'react-native';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
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
  /** `dark` for stamps pressed onto the deep-green achievements page. */
  tone?: 'light' | 'dark';
  /** Icon drawn when the stamp has no artwork (regions; a game without
   * cover art yet) - should say what kind of stamp it is. */
  fallbackIcon?: LucideIcon;
  /** Slot width from the parent grid, so a row of stamps spreads evenly. */
  slotWidth?: number;
  onPress?: () => void;
};

const TILTS = ['-6deg', '4deg', '-2deg', '5deg', '-4deg', '2deg'];

/**
 * One passport stamp. Earned: full-color artwork inside a double gold ring,
 * pressed at a slight angle, with a small gold oymo diamond "seal" at the
 * top - the same ornament OYNO uses on its headers. Not yet earned: a
 * faded dashed "empty slot" with a hollow seal - still tappable, so an
 * empty passport page doubles as a map of where to go next rather than a
 * wall of locks.
 */
export function JourneyStamp({ stamp, size, index, showDetail, tone = 'light', fallbackIcon: FallbackIcon = MapPin, slotWidth, onPress }: JourneyStampProps) {
  const inner = size - 12;
  const isDark = tone === 'dark';

  return (
    <AnimatedPressable
      style={[styles.wrap, { width: slotWidth ?? size + spacing.sm }]}
      onPress={onPress}
      disabled={!onPress}
      hoverEffect
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={stamp.title}
      accessibilityState={{ selected: stamp.earned }}
    >
      <View style={{ width: size, height: size, transform: [{ rotate: stamp.earned ? TILTS[index % TILTS.length] : '0deg' }] }}>
        <View
          style={[
            styles.ring,
            { width: size, height: size, borderRadius: size / 2 },
            stamp.earned ? styles.ringEarned : isDark ? styles.ringEmptyDark : styles.ringEmpty,
          ]}
        >
          <View
            style={[
              styles.inner,
              { width: inner, height: inner, borderRadius: inner / 2 },
              stamp.earned ? styles.innerEarned : isDark ? styles.innerEmptyDark : styles.innerEmpty,
            ]}
          >
            {stamp.imageSource ? (
              <Image source={stamp.imageSource} style={[styles.image, !stamp.earned && styles.imageEmpty]} resizeMode="cover" />
            ) : (
              <FallbackIcon
                size={inner * 0.38}
                color={stamp.earned ? colors.accentTerracotta : isDark ? 'rgba(255,255,255,0.35)' : colors.textMuted}
                strokeWidth={1.75}
              />
            )}
          </View>
        </View>

        <View style={[styles.seal, { left: size / 2 - 9 }, stamp.earned ? styles.sealEarned : isDark ? styles.sealEmptyDark : styles.sealEmpty]}>
          <OymoOrnament size={10} color={stamp.earned ? colors.textPrimary : isDark ? 'rgba(255,255,255,0.4)' : colors.border} strokeWidth={2} />
        </View>
      </View>

      <Text
        style={[styles.title, isDark && styles.titleDark, !stamp.earned && (isDark ? styles.titleEmptyDark : styles.titleEmpty)]}
        numberOfLines={2}
      >
        {stamp.title}
      </Text>
      {showDetail && stamp.detail ? (
        <Text style={[styles.detail, isDark && styles.detailDark]} numberOfLines={1}>
          {stamp.detail}
        </Text>
      ) : null}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: spacing.xs,
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
  ringEmptyDark: {
    borderColor: 'rgba(255,255,255,0.28)',
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  inner: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  innerEarned: {
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.accentGoldPressed,
  },
  innerEmpty: {
    backgroundColor: colors.surfaceAlt,
    borderColor: 'transparent',
  },
  innerEmptyDark: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'transparent',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageEmpty: {
    opacity: 0.25,
  },
  // Small diamond seal sitting on the ring's top edge.
  seal: {
    position: 'absolute',
    top: -7,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealEarned: {
    backgroundColor: colors.accentGold,
  },
  sealEmpty: {
    backgroundColor: colors.background,
  },
  sealEmptyDark: {
    backgroundColor: colors.surfaceFeature,
  },
  title: {
    ...typography.small,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  titleDark: {
    color: colors.textOnDark,
  },
  titleEmpty: {
    color: colors.textMuted,
  },
  titleEmptyDark: {
    color: 'rgba(255,255,255,0.5)',
  },
  detail: {
    ...typography.small,
    fontWeight: '500',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  detailDark: {
    color: 'rgba(255,255,255,0.7)',
  },
});
