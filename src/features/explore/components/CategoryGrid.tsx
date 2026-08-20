import {
  Home,
  Mountain,
  Music,
  PawPrint,
  Scissors,
  ScrollText,
  Swords,
  Target,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import { colors, radii, shadows, spacing, typography } from '@/theme';

import type { ExploreCategoryId } from '../types';

type CategoryDef = { id: ExploreCategoryId; label: string; icon: LucideIcon };

const CATEGORIES: CategoryDef[] = [
  { id: 'nature', label: 'Жаратылыш', icon: Mountain },
  { id: 'games', label: 'Оюндар', icon: Swords },
  { id: 'food', label: 'Ашкана', icon: UtensilsCrossed },
  { id: 'music', label: 'Музыка', icon: Music },
  { id: 'culture', label: 'Маданият', icon: Home },
  { id: 'history', label: 'Тарых', icon: ScrollText },
  { id: 'crafts', label: 'Кол өнөрчүлүк', icon: Scissors },
  { id: 'animals', label: 'Жаныбарлар', icon: PawPrint },
  { id: 'quests', label: 'Квесттер', icon: Target },
];

type CategoryGridProps = {
  onPressCategory?: (category: ExploreCategoryId) => void;
};

/**
 * Region-specific content for these categories isn't researched yet (see
 * content/explore/ysyk-kol.md UNVERIFIED note), so every tile is a visual
 * placeholder for now - onPressCategory is wired but intentionally has
 * nothing real to show.
 */
export function CategoryGrid({ onPressCategory }: CategoryGridProps) {
  return (
    <View style={styles.grid}>
      {CATEGORIES.map((category) => (
        <AnimatedPressable
          key={category.id}
          style={styles.tile}
          onPress={() => onPressCategory?.(category.id)}
          accessibilityRole="button"
          accessibilityLabel={category.label}
        >
          <View style={styles.iconWrap}>
            <category.icon size={22} color={colors.primary} strokeWidth={1.75} />
          </View>
          <Text style={styles.label} numberOfLines={1}>
            {category.label}
          </Text>
        </AnimatedPressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tile: {
    width: '30%',
    alignItems: 'center',
    gap: spacing.xxs,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingVertical: spacing.sm,
    ...shadows.card,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...typography.small,
    color: colors.textPrimary,
    fontWeight: '600',
    textAlign: 'center',
  },
});
