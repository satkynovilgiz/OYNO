import { Check, Lock, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import { colors, radii, spacing, typography } from '@/theme';

type ItemCardProps = {
  /** 1-based position within its category - stands in for real artwork
   * when `imageSource` is absent (no illustration exists yet for that
   * particular catalog item, see avatarCatalog.ts's isPlaceholder flag),
   * so the card reads as an honest "slot", not a broken image. */
  index: number;
  icon: LucideIcon;
  /** Real sliced illustration for this item, from avatarArt.ts - when
   * present, replaces the icon+index placeholder entirely. */
  imageSource?: ImageSourcePropType | null;
  label: string;
  selected: boolean;
  locked: boolean;
  isNew?: boolean;
  onPress: () => void;
};

export function ItemCard({ index, icon: Icon, imageSource, label, selected, locked, isNew, onPress }: ItemCardProps) {
  const { t } = useTranslation();

  return (
    <AnimatedPressable
      style={[styles.card, selected && styles.cardSelected, locked && styles.cardLocked]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: locked }}
      accessibilityLabel={locked ? `${label} - ${t('avatar.itemLocked')}` : label}
    >
      {imageSource ? (
        <Image source={imageSource} style={styles.itemImage} resizeMode="cover" />
      ) : (
        <View style={[styles.iconWrap, selected && styles.iconWrapSelected]}>
          <Icon size={22} color={selected ? colors.primary : colors.textSecondary} strokeWidth={1.75} />
          <Text style={[styles.index, selected && styles.indexSelected]}>{index}</Text>
        </View>
      )}

      {selected && (
        <View style={styles.checkBadge}>
          <Check size={12} color={colors.textOnPrimary} strokeWidth={3} />
        </View>
      )}
      {locked && (
        <View style={styles.lockBadge}>
          <Lock size={12} color={colors.textSecondary} strokeWidth={2} />
        </View>
      )}
      {isNew && !locked && (
        <View style={styles.newBadge}>
          <Text style={styles.newBadgeLabel}>{t('avatar.newBadge')}</Text>
        </View>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.surfaceBorder,
    overflow: 'hidden',
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceAlt,
  },
  cardLocked: {
    opacity: 0.55,
  },
  iconWrap: {
    alignItems: 'center',
    gap: 2,
  },
  iconWrapSelected: {},
  index: {
    ...typography.small,
    color: colors.textMuted,
    fontWeight: '700',
  },
  indexSelected: {
    color: colors.primary,
  },
  checkBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  lockBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  newBadge: {
    position: 'absolute',
    top: -6,
    left: -6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radii.pill,
    backgroundColor: colors.accentGold,
  },
  newBadgeLabel: {
    ...typography.small,
    fontSize: 9,
    color: colors.textPrimary,
    fontWeight: '700',
  },
});
