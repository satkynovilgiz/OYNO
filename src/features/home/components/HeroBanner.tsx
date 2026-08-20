import { Image, StyleSheet, View } from 'react-native';

import { radii, shadows } from '@/theme';
import heroBanner from '@assets/img/hero_banner.png';

/** Boz Üy + grassland scene illustration with the cast of characters. */
export function HeroBanner() {
  return (
    // Shadow and corner-clipping live on separate layers: RN drops a
    // view's own shadow when it also clips its content via overflow.
    <View style={[styles.shadowWrap, shadows.card]}>
      <View style={styles.clip}>
        <Image source={heroBanner} style={styles.image} resizeMode="cover" />
      </View>
    </View>
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
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
