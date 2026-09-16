import { Image, StyleSheet, View } from 'react-native';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { FadeSlideIn } from '@/components/ui';
import { colors, radii, shadows } from '@/theme';
import heroBanner from '@assets/img/OYNO_design/hero_banner.png';

/** Boz Üy + grassland scene illustration with the cast of characters. A
 * thin gold frame + a small corner оймо accent (Section "subtle Kyrgyz
 * оймо details in dividers, corners, or accents") dress up what was a
 * bare rectangular image, without adding a caption/CTA it doesn't need. */
export function HeroBanner() {
  return (
    // Shadow and corner-clipping live on separate layers: RN drops a
    // view's own shadow when it also clips its content via overflow.
    <FadeSlideIn style={[styles.shadowWrap, shadows.card]}>
      <View style={styles.clip}>
        <Image source={heroBanner} style={styles.image} resizeMode="cover" />
        <View style={styles.ornamentBadge}>
          <OymoOrnament size={14} color={colors.accentGold} strokeWidth={1.5} />
        </View>
      </View>
    </FadeSlideIn>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    width: '100%',
    aspectRatio: 853 / 457,
    borderRadius: radii.xl,
  },
  clip: {
    flex: 1,
    borderRadius: radii.xl,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(232,185,61,0.4)',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  ornamentBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(43,32,25,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
