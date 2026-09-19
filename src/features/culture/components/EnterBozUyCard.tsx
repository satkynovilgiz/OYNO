import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable, FadeSlideIn } from '@/components/ui';
import { colors, radii, spacing, typography } from '@/theme';
import artwork from '@assets/img/OYNO_design/culture/enter_boz_uy.jpg';

type EnterBozUyCardProps = {
  onPress?: () => void;
};

/** Full-width interactive banner - promoted out of the 50/50 row it used
 * to share with TodayDiscoveryCard (now its own full-width featured
 * story) since entering the 3D boz üy is itself a hands-on experience,
 * not a passive read, and deserves the same visual confidence as the
 * Interactive experiences row above it. */
export function EnterBozUyCard({ onPress }: EnterBozUyCardProps) {
  const { t } = useTranslation();

  return (
    <FadeSlideIn>
      <AnimatedPressable
        style={styles.card}
        onPress={onPress}
        hoverEffect
        accessibilityRole="button"
        accessibilityLabel={t('culture.enterBozUy.title')}
      >
        <Image source={artwork} style={styles.image} resizeMode="cover" />
        <LinearGradient
          colors={['rgba(20,14,8,0.8)', 'rgba(20,14,8,0.1)', 'rgba(20,14,8,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          locations={[0, 0.6, 1]}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.content}>
          <Text style={styles.title}>{t('culture.enterBozUy.title')}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {t('culture.enterBozUy.subtitle')}
          </Text>
        </View>
        <View style={styles.ctaBadge}>
          <ArrowRight size={16} color={colors.textPrimary} strokeWidth={2.5} />
        </View>
      </AnimatedPressable>
    </FadeSlideIn>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    aspectRatio: 2.2,
    borderRadius: radii.xxl,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  // Explicit width/height alongside the absolute-fill insets - see
  // EditorialCard.tsx's own artwork style comment for why insets alone can
  // leave Image sized by its intrinsic pixels instead of the card.
  image: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  content: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.h1,
    color: colors.textOnDark,
  },
  subtitle: {
    ...typography.small,
    color: 'rgba(255,255,255,0.85)',
  },
  ctaBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
