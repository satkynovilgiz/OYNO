import { Image, StyleSheet, Text, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radii, spacing, typography } from '@/theme';

import { AnimatedPressable } from './AnimatedPressable';

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
  style?: StyleProp<ViewStyle>;
};

/** Image-first, title-below card (Section "EDITORIAL CARD: image-first,
 * title + small metadata, minimal border") - the default "browse content"
 * card family (Culture categories, discoveries, materials). No dark
 * overlay bar across the artwork; the title lives in a plain text block
 * below the image so the photo/illustration stays fully visible. */
export function EditorialCard({ imageSource, title, meta, onPress, aspectRatio = 4 / 3, size = 'standard', style }: EditorialCardProps) {
  const isFeature = size === 'feature';

  return (
    <AnimatedPressable
      style={[styles.card, style]}
      onPress={onPress}
      hoverEffect
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <Image source={imageSource} style={[styles.image, { aspectRatio }]} resizeMode="cover" />
      <View style={styles.textBlock}>
        <Text style={[styles.title, isFeature && styles.titleFeature]} numberOfLines={2}>
          {title}
        </Text>
        {meta ? (
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
  },
  image: {
    width: '100%',
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceAlt,
  },
  textBlock: {
    paddingTop: spacing.xs,
    gap: 1,
  },
  title: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  titleFeature: {
    ...typography.h2,
  },
  meta: {
    ...typography.small,
    color: colors.textMuted,
  },
});
