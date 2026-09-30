import { Image, StyleSheet, Text, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { colors, radii, spacing, typography } from '@/theme';

import { AnimatedPressable } from './AnimatedPressable';

type CompactContentCardProps = {
  /** null = content without a photo: its tone + oymo mark, never a blank box. */
  imageSource: ImageSourcePropType | null;
  fallbackTone?: string;
  title: string;
  meta?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  /** Card (and image, and text) width; every card in a row gets the same one. */
  width?: number;
  /** Defaults to the title; pass more when the card carries state. */
  accessibilityLabel?: string;
};

const FRAME_ASPECT = 4 / 3;

/** Thumbnail + title + metadata row (Section "COMPACT CONTENT CARD") - the
 * smallest, lightest card family, for dense horizontal lists (materials,
 * favorites) where a full editorial treatment would be too heavy. No
 * border - separation comes from spacing between cards, not a box. Every
 * thumbnail is the same 4:3 frame, filled with `cover`, whatever the
 * source image's own size. */
export function CompactContentCard({ imageSource, title, meta, onPress, style, width = 128, fallbackTone = colors.surfaceFeature, accessibilityLabel }: CompactContentCardProps) {
  return (
    <AnimatedPressable style={[styles.card, { width }, style]} onPress={onPress} hoverEffect accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title}>
      <View style={[styles.frame, { width, height: Math.round(width / FRAME_ASPECT) }]}>
        {imageSource ? (
          <Image source={imageSource} style={styles.fill} resizeMode="cover" />
        ) : (
          <View style={[styles.fill, styles.tone, { backgroundColor: fallbackTone }]}>
            <OymoOrnament size={Math.round(width / 3)} color="rgba(251,243,227,0.3)" strokeWidth={1.2} />
          </View>
        )}
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
  tone: {
    alignItems: 'center',
    justifyContent: 'center',
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
