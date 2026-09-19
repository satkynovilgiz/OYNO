import { LinearGradient } from 'expo-linear-gradient';
import { type LucideIcon } from 'lucide-react-native';
import { Image, StyleSheet, Text, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radii, spacing, typography } from '@/theme';

import { AnimatedPressable } from './AnimatedPressable';

type InteractiveCardProps = {
  imageSource: ImageSourcePropType;
  title: string;
  ctaIcon: LucideIcon;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

/** Signals "this is an activity, not just something to read" (Section
 * "INTERACTIVE CARD: visually signals an activity/creator, stronger CTA")
 * - a gold CTA roundel over the artwork instead of a plain border, so
 * creator tools (Oymo/Shyrdak/Boz Uy builders) read as tappable
 * experiences at a glance. */
export function InteractiveCard({ imageSource, title, ctaIcon: CtaIcon, onPress, style }: InteractiveCardProps) {
  return (
    <AnimatedPressable
      style={[styles.card, style]}
      onPress={onPress}
      hoverEffect
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <Image source={imageSource} style={styles.artwork} resizeMode="cover" />
      <LinearGradient colors={['transparent', colors.overlayEnd]} locations={[0.4, 1]} style={StyleSheet.absoluteFill} />
      <View style={styles.ctaBadge}>
        <CtaIcon size={16} color={colors.textPrimary} strokeWidth={2.25} />
      </View>
      <View style={styles.overlay} pointerEvents="box-none">
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  // Owns sizing/overflow only - no padding here. See TodayDiscoveryCard's
  // `card`/`overlay` comment: padding directly on the node that also
  // positions an absolute-fill child makes that child's percentage
  // width/height fall short of the true edge (Yoga resolves the explicit
  // 0 inset against the border edge, but percentage size against the
  // padding-reduced content box). Padding moves to `overlay` instead.
  card: {
    width: 148,
    height: 118,
    borderRadius: radii.xl,
    overflow: 'hidden',
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
  overlay: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
    padding: spacing.sm,
  },
  ctaBadge: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.accentGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textOnDark,
  },
});
