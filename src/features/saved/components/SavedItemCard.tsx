import { LinearGradient } from 'expo-linear-gradient';
import { Gamepad2, Heart } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import type { CatalogItem } from '@/services/content/contentCatalog';
import { colors, radii, spacing, typography } from '@/theme';

type SavedItemCardProps = {
  item: CatalogItem;
  onPress: () => void;
  onPressRemove: () => void;
};

/** Artwork-first grid tile for the Saved screen (spec "Use artwork-first
 * cards consistent with the new OYNO design... artwork, title, content
 * type, useful metadata, favorite indicator"). The filled heart in the
 * corner doubles as the remove control - tapping it un-favorites in
 * place, no separate edit mode. */
export function SavedItemCard({ item, onPress, onPressRemove }: SavedItemCardProps) {
  const { t } = useTranslation();

  return (
    <AnimatedPressable style={styles.card} onPress={onPress} hoverEffect haptic="light" accessibilityRole="button" accessibilityLabel={item.title}>
      {item.thumbnail ? (
        <Image source={item.thumbnail} style={styles.artwork} resizeMode="cover" />
      ) : (
        <View style={[styles.artwork, styles.artworkFallback]}>
          <Gamepad2 size={32} color={colors.accentGold} strokeWidth={1.5} />
        </View>
      )}
      <LinearGradient colors={['rgba(19,32,24,0)', 'rgba(19,32,24,0.85)']} locations={[0.4, 1]} style={StyleSheet.absoluteFill} />

      <AnimatedPressable
        style={styles.favoriteBadge}
        onPress={onPressRemove}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t('saved.removeLabel')}
      >
        <Heart size={14} color={colors.accentGold} fill={colors.accentGold} strokeWidth={0} />
      </AnimatedPressable>

      <View style={styles.content}>
        <Text style={styles.typeLabel}>{t(`saved.contentTypes.${item.contentType}`)}</Text>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
        {item.metadata ? (
          <Text style={styles.metadata} numberOfLines={1}>
            {item.metadata}
          </Text>
        ) : null}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    aspectRatio: 0.85,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  // Explicit width/height alongside absoluteFill, not absoluteFill alone -
  // an Image is a "replaced element" and won't stretch from inset
  // positioning the way a plain View does (see OnboardingScreen.tsx's
  // slideImage style for the full writeup of this exact bug).
  artwork: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  artworkFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteBadge: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(19,32,24,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.sm,
    gap: 2,
  },
  typeLabel: {
    ...typography.small,
    color: colors.accentGold,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  title: {
    ...typography.bodyBold,
    color: colors.textOnDark,
  },
  metadata: {
    ...typography.small,
    color: 'rgba(255,255,255,0.75)',
  },
});
