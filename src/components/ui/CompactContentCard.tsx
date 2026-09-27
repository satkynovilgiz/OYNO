import { Image, StyleSheet, Text, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radii, spacing, typography } from '@/theme';

import { AnimatedPressable } from './AnimatedPressable';

type CompactContentCardProps = {
  imageSource: ImageSourcePropType;
  title: string;
  meta?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  /** Card (and image, and text) width; every card in a row gets the same one. */
  width?: number;
};

const FRAME_ASPECT = 4 / 3;

/** Thumbnail + title + metadata row (Section "COMPACT CONTENT CARD") - the
 * smallest, lightest card family, for dense horizontal lists (materials,
 * favorites) where a full editorial treatment would be too heavy. No
 * border - separation comes from spacing between cards, not a box. Every
 * thumbnail is the same 4:3 frame, filled with `cover`, whatever the
 * source image's own size. */
export function CompactContentCard({ imageSource, title, meta, onPress, style, width = 128 }: CompactContentCardProps) {
  return (
    <AnimatedPressable style={[styles.card, { width }, style]} onPress={onPress} hoverEffect accessibilityRole="button" accessibilityLabel={title}>
      <View style={[styles.frame, { width, height: Math.round(width / FRAME_ASPECT) }]}>
        <Image source={imageSource} style={styles.fill} resizeMode="cover" />
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
      {meta ? (
        <Text style={styles.meta} numberOfLines={1}>
          {meta}
        </Text>
      ) : null}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 2,
  },
  frame: {
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  // Explicit size: without it, web falls back to the file's own pixel size.
  fill: {
    width: '100%',
    height: '100%',
  },
  title: {
    ...typography.small,
    color: colors.textPrimary,
    fontWeight: '700',
    marginTop: spacing.xxs,
    lineHeight: 17,
  },
  meta: {
    ...typography.small,
    color: colors.textMuted,
  },
});
