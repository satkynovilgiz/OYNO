import { LinearGradient } from 'expo-linear-gradient';
import { Image, StyleSheet, Text, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';

import { GRADIENT_BY_ARTWORK_PROMINENCE } from '@/services/ageExperience/cardGradient';
import { resolveByCardScale } from '@/services/ageExperience/scale';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { colors, radii, spacing, typography } from '@/theme';

import { AnimatedPressable } from './AnimatedPressable';

/** Title font size per cardScale, standard vs. the taller `feature`
 * variant - child reads noticeably larger, adult noticeably denser,
 * without a screen having to pass anything extra in. */
const TITLE_FONT_SIZE = {
  standard: { large: 18, medium: 15, compact: 14, dense: 13 },
  feature: { large: 23, medium: 17, compact: 16, dense: 15 },
};

type EditorialCardProps = {
  imageSource: ImageSourcePropType;
  title: string;
  meta?: string;
  onPress?: () => void;
  aspectRatio?: number;
  /** `feature` is a taller, larger-type variant for the one standout item
   * in a mixed layout (Section "one large featured category"); `standard`
   * (default) is the regular supporting-card size. */
  size?: 'feature' | 'standard';
  /** Renders `meta` (a "current / total" string) as a small progress
   * badge with a gold accent once complete, instead of plain caption text
   * (Section "Show progress... as a small elegant progress indicator"). */
  progress?: { current: number; total: number };
  /** Max title lines for a `standard` card (default 1) - for rows whose
   * titles are long editorial phrases that must not truncate. */
  titleLines?: number;
  style?: StyleProp<ViewStyle>;
};

/** One complete visual object, edge-to-edge artwork with the title living
 * on the image itself (Section "Make every category a complete rounded
 * card rather than loose image + text... title inside the artwork near
 * the bottom") - the default "browse content" card family (Culture
 * categories). A thin gold highlight frames the artwork instead of a
 * heavy beige container around it. */
export function EditorialCard({ imageSource, title, meta, onPress, aspectRatio = 4 / 3, size = 'standard', progress, titleLines = 1, style }: EditorialCardProps) {
  const { config } = useAgeExperience();
  const isFeature = size === 'feature';
  const isComplete = !!progress && progress.total > 0 && progress.current >= progress.total;
  const gradient = GRADIENT_BY_ARTWORK_PROMINENCE[config.artworkProminence];
  const titleFontSize = resolveByCardScale(config.cardScale, TITLE_FONT_SIZE[isFeature ? 'feature' : 'standard']);

  return (
    <AnimatedPressable
      style={[styles.card, { aspectRatio }, style]}
      onPress={onPress}
      pressScale={0.98}
      hoverEffect
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <Image source={imageSource} style={styles.artwork} resizeMode="cover" />
      <LinearGradient colors={gradient.colors} locations={gradient.locations} style={StyleSheet.absoluteFill} />

      <View style={styles.content}>
        <Text style={[styles.title, { fontSize: titleFontSize }]} numberOfLines={isFeature ? 2 : titleLines}>
          {title}
        </Text>
        {meta ? (
          <View style={[styles.metaBadge, isComplete && styles.metaBadgeComplete]}>
            <Text style={[styles.meta, isComplete && styles.metaComplete]}>{meta}</Text>
          </View>
        ) : null}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 22,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: 'rgba(232,185,61,0.35)',
  },
  // Explicit width/height alongside the absolute-fill insets - insets
  // alone (StyleSheet.absoluteFill) can leave Image sized by its own
  // intrinsic pixel dimensions instead of the aspectRatio-driven parent on
  // the first layout pass (a real, reproduced-on-device Yoga/Image race,
  // not a web-only quirk), rendering the artwork as a small block in the
  // corner with empty space around it. Explicit percentages force a
  // correct remeasure every time.
  artwork: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  content: {
    padding: spacing.sm,
    gap: spacing.xxs,
  },
  title: {
    ...typography.bodyBold,
    color: colors.textOnDark,
  },
  metaBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  metaBadgeComplete: {
    backgroundColor: colors.accentGold,
  },
  meta: {
    ...typography.small,
    fontWeight: '700',
    color: colors.textOnDark,
  },
  metaComplete: {
    color: colors.textPrimary,
  },
});
