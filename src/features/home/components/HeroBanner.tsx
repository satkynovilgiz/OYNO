import { Image, StyleSheet } from 'react-native';

import { radii, shadows } from '@/theme';
import heroBanner from '@assets/img/hero_banner.png';

/** Boz Üy + grassland scene illustration with the cast of characters. */
export function HeroBanner() {
  return <Image source={heroBanner} style={styles.container} resizeMode="cover" />;
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 853 / 457,
    borderRadius: radii.xl,
    ...shadows.card,
  },
});
