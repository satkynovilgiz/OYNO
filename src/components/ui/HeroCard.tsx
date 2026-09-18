import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode } from 'react';
import { Image, StyleSheet, Text, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radii, spacing, typography } from '@/theme';

import { AnimatedPressable } from './AnimatedPressable';

type HeroCardProps = {
  imageSource: ImageSourcePropType;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  /** Extra content rendered above the title (a chip, an oymo mark) - kept
   * optional so most callers just pass title/subtitle. */
  children?: ReactNode;
  aspectRatio?: number;
  style?: StyleProp<ViewStyle>;
};

/** Large, immersive, minimal-text card - the "hero" tier (Section "HERO
 * CARD: large artwork, minimal text, immersive, optional gradient
 * overlay"). No border, no cream chrome - the image and a bottom gradient
 * scrim do all the work. Use for the single most important thing on a
 * screen (a featured game, a culture hero, a featured discovery), not for
 * routine grid content. */
export function HeroCard({ imageSource, title, subtitle, onPress, children, aspectRatio = 16 / 10, style }: HeroCardProps) {
  return (
    <AnimatedPressable
      style={[styles.card, { aspectRatio }, style]}
      onPress={onPress}
      hoverEffect
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={title}
    >
      <Image source={imageSource} style={styles.artwork} resizeMode="cover" />
      <LinearGradient
        colors={[colors.overlayStart, 'rgba(20,14,8,0.15)', colors.overlayEnd]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.content}>
        {children}
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: radii.xxl,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: colors.surfaceAlt,
  },
  // Explicit width/height alongside the absolute-fill insets - see
  // EditorialCard.tsx's own artwork style comment for why insets alone can
  // leave Image sized by its intrinsic pixels instead of the card.
  artwork: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  content: {
    padding: spacing.lg,
    gap: spacing.xxs,
  },
  title: {
    ...typography.display,
    color: colors.textOnDark,
  },
  subtitle: {
    ...typography.body,
    color: 'rgba(255,255,255,0.88)',
  },
});
