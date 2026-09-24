import { useState } from 'react';
import { Image, StyleSheet, Text, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { colors, fontFamily } from '@/theme';

/**
 * Game artwork with a designed fallback: if a game has no art (or its art
 * fails to load) the card shows a forest-green oymo tile with the game's
 * initial - never a blank or broken card.
 */
export function GameArt({ source, title, style, ornamentSize = 64 }: { source: ImageSourcePropType | null; title: string; style?: StyleProp<ViewStyle>; ornamentSize?: number }) {
  const [failed, setFailed] = useState(false);
  if (source && !failed) {
    return (
      <View style={[styles.frame, style]}>
        <Image source={source} style={styles.fill} resizeMode="cover" onError={() => setFailed(true)} accessibilityIgnoresInvertColors />
      </View>
    );
  }
  return (
    <View style={[styles.frame, styles.fallback, style]}>
      <OymoOrnament size={ornamentSize} color="rgba(232,185,61,0.35)" strokeWidth={1.25} />
      <Text style={[styles.initial, { fontSize: ornamentSize * 0.42 }]}>{title.charAt(0)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', backgroundColor: colors.surfaceFeature },
  fill: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  fallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  initial: { position: 'absolute', fontFamily: fontFamily.wordmark, fontWeight: '700', color: colors.accentGold },
});
