import { Image, type ImageContentPosition } from 'expo-image';
import { Image as RNImage, StyleSheet, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';

import { useReducedMotion } from '@/services/motion/useReducedMotion';
import { colors, motion } from '@/theme';

/** Pixel width of a bundled image source, when knowable (native: asset
 * registry; web: the asset object carries width). Null = unknown. */
export function sourceWidth(source: ImageSourcePropType | null | undefined): number | null {
  if (!source) return null;
  try {
    if (typeof source === 'number') return RNImage.resolveAssetSource(source)?.width ?? null;
    if (!Array.isArray(source) && typeof source === 'object' && 'width' in source && typeof source.width === 'number') return source.width;
  } catch {
    // Unknown size - treat as fine.
  }
  return null;
}

/** Below this, an image can't fill a full-width card without pixelating. */
export const MIN_BACKDROP_WIDTH = 600;

/** Picks what a full-bleed card should actually draw: `source`, unless it is
 * known to be too small to fill a card and a real high-res `backdrop` from
 * the same category exists - tiny art is never upscaled. */
export function resolveMediaSource(source: ImageSourcePropType, backdrop?: ImageSourcePropType | null): ImageSourcePropType {
  const width = sourceWidth(source);
  return width !== null && width < MIN_BACKDROP_WIDTH && backdrop ? backdrop : source;
}

/**
 * The standard media image: cover crop with an explicit focal position,
 * a warm tonal placeholder while decoding, a short fade-in (skipped under
 * Reduce Motion), memory+disk caching via expo-image, and the low-res
 * backdrop rule above. Fills its parent by default (absolute fill).
 */
export function MediaImage({
  source,
  backdrop,
  position = 'center',
  fill = true,
  style,
}: {
  source: ImageSourcePropType;
  backdrop?: ImageSourcePropType | null;
  /** Focal point kept in frame when cropping (e.g. 'top' for portraits). */
  position?: ImageContentPosition;
  fill?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <Image
      source={resolveMediaSource(source, backdrop) as never}
      style={[fill && styles.fill, styles.placeholder, style as never]}
      contentFit="cover"
      contentPosition={position}
      transition={reducedMotion ? 0 : motion.fadeIn.durationMs}
      cachePolicy="memory-disk"
      accessibilityIgnoresInvertColors
    />
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  placeholder: { backgroundColor: colors.surfaceFeature },
});
