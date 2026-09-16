import { Image, StyleSheet, Text, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radii, spacing, typography } from '@/theme';

import { AnimatedPressable } from './AnimatedPressable';

type CompactContentCardProps = {
  imageSource: ImageSourcePropType;
  title: string;
  meta?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

/** Thumbnail + title + metadata row (Section "COMPACT CONTENT CARD") - the
 * smallest, lightest card family, for dense horizontal lists (materials,
 * favorites) where a full editorial treatment would be too heavy. No
 * border - separation comes from spacing between cards, not a box. */
export function CompactContentCard({ imageSource, title, meta, onPress, style }: CompactContentCardProps) {
  return (
    <AnimatedPressable style={[styles.card, style]} onPress={onPress} hoverEffect accessibilityRole="button" accessibilityLabel={title}>
      <Image source={imageSource} style={styles.image} resizeMode="cover" />
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
    width: 128,
    gap: 2,
  },
  image: {
    width: '100%',
    height: 88,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
  },
  title: {
    ...typography.small,
    color: colors.textPrimary,
    fontWeight: '700',
    marginTop: 2,
    lineHeight: 14,
  },
  meta: {
    ...typography.small,
    color: colors.textMuted,
  },
});
