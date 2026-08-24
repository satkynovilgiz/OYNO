import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import { colors, radii, shadows, spacing, typography } from '@/theme';
import artwork from '@assets/img/OYNO_design/culture/enter_boz_uy.png';

type EnterBozUyCardProps = {
  onPress?: () => void;
};

/** The art already bakes in a door icon as the "enter" affordance (sliced
 * from the design reference), so this just adds the localized title text
 * over a top gradient for legibility. */
export function EnterBozUyCard({ onPress }: EnterBozUyCardProps) {
  const { t } = useTranslation();

  return (
    <AnimatedPressable
      style={styles.card}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('culture.enterBozUy.title')}
    >
      <Image source={artwork} style={[StyleSheet.absoluteFill, styles.image]} resizeMode="cover" />
      <LinearGradient
        colors={['rgba(20,14,8,0.85)', 'rgba(20,14,8,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        locations={[0, 0.6]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.content}>
        <Text style={styles.title}>{t('culture.enterBozUy.title')}</Text>
        <Text style={styles.subtitle}>{t('culture.enterBozUy.subtitle')}</Text>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: radii.xl,
    overflow: 'hidden',
    padding: spacing.sm,
    justifyContent: 'flex-start',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    ...shadows.card,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  content: {
    gap: 2,
  },
  title: {
    ...typography.h1,
    color: colors.textOnDark,
  },
  subtitle: {
    ...typography.small,
    color: colors.textOnDark,
    opacity: 0.9,
  },
});
