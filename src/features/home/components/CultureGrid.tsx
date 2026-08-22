import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';

import { IconButton } from '@/components/ui';
import { colors, radii, shadows, spacing, typography } from '@/theme';

import type { CultureTile } from '../types';

type CultureGridProps = {
  tiles: CultureTile[];
  onPressTile?: (tile: CultureTile) => void;
};

export function CultureGrid({ tiles, onPressTile }: CultureGridProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.grid}>
      {tiles.map((tile) => (
        <View key={tile.id} style={styles.tile}>
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
              <Text style={styles.title} numberOfLines={1}>
                {tile.title}
              </Text>
              <Text style={styles.subtitle} numberOfLines={2}>
                {tile.subtitle}
              </Text>
            </View>
            <IconButton
              icon={ChevronRight}
              size={32}
              accessibilityLabel={t('home.culture.openLabel')}
              onPress={() => onPressTile?.(tile)}
            />
          </View>
        </View>
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
});
