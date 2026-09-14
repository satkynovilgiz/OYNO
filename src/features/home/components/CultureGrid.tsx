import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight } from 'lucide-react-native';
import { Image, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import { colors, radii, shadows, spacing, typography } from '@/theme';

import type { CultureTile } from '../types';

type CultureGridProps = {
  tiles: CultureTile[];
  onPressTile?: (tile: CultureTile) => void;
};

export function CultureGrid({ tiles, onPressTile }: CultureGridProps) {
  return (
    <View style={styles.grid}>
      {tiles.map((tile) => (
        <AnimatedPressable
          key={tile.id}
          style={styles.tile}
          onPress={() => onPressTile?.(tile)}
          hoverEffect
          accessibilityRole="button"
          accessibilityLabel={tile.title}
        >
          {tile.imageSource ? (
            <Image source={tile.imageSource} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : tile.imageUri ? (
            <Image source={{ uri: tile.imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.tiles[tile.tone] }]} />
          )}

          <LinearGradient
            colors={[colors.overlayStart, colors.overlayEnd]}
            locations={[0.35, 1]}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.content}>
            <View style={styles.textBlock}>
              <Text style={styles.title} numberOfLines={2}>
                {tile.title}
              </Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {tile.subtitle}
              </Text>
            </View>
            {/* Decorative only - the whole tile is already the tap target
                (accessibilityRole/Label live on the outer AnimatedPressable
                above), so this must not be its own Pressable: a Pressable
                nested inside a Pressable triggers a web a11y warning and
                double-fires the identical onPress on native. */}
            <View style={styles.chevronBadge}>
              <ChevronRight size={14} color={colors.primary} strokeWidth={2.25} />
            </View>
          </View>
        </AnimatedPressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  tile: {
    width: '47%',
    aspectRatio: 1.5,
    borderRadius: radii.xl,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    ...shadows.card,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    padding: spacing.sm,
    gap: spacing.xxs,
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.h2,
    color: colors.textOnDark,
  },
  subtitle: {
    ...typography.small,
    color: colors.textOnDark,
    opacity: 0.9,
  },
  chevronBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    ...shadows.card,
  },
});
