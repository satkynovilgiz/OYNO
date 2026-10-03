import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';

import type { ShareCardContent } from '@/components/share/ShareCard';
import { colors } from '@/theme';

const FRAME = { width: 900, height: 560 };

/** Compare share card: two images, two titles and "Compare in OYNO" -
 * never the comparison text itself. */
export function buildCompareShareCard(input: { leftTitle: string; rightTitle: string; leftImage: ImageSourcePropType | null; rightImage: ImageSourcePropType | null; label: string }): ShareCardContent {
  return {
    title: `${input.leftTitle} · ${input.rightTitle}`,
    label: input.label,
    imageSource: null,
    variant: 'creation',
    artworkSize: FRAME,
    artwork: (
      <View style={styles.pair}>
        {[input.leftImage, input.rightImage].map((source, index) => (
          <View key={index} style={styles.half}>
            {source ? <Image source={source} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
          </View>
        ))}
      </View>
    ),
  };
}

const styles = StyleSheet.create({
  pair: { width: FRAME.width, height: FRAME.height, flexDirection: 'row', gap: 16 },
  half: { flex: 1, borderRadius: 32, overflow: 'hidden', backgroundColor: colors.surfaceFeature },
});
