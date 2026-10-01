import type { ImageSourcePropType } from 'react-native';
import { StyleSheet, View } from 'react-native';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { MediaImage } from '@/components/ui';
import { colors } from '@/theme';

/** The first item's own image, else the OYNO tone + ornament - never an
 * upload, never a broken image. */
export function CollectionCover({ source, size, radius }: { source: ImageSourcePropType | null; size: number; radius: number }) {
  return (
    <View style={[styles.cover, { width: size, height: size, borderRadius: radius }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {source ? <MediaImage source={source} /> : <OymoOrnament size={size * 0.45} color="rgba(251,243,227,0.55)" strokeWidth={1.25} />}
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceFeature },
});
