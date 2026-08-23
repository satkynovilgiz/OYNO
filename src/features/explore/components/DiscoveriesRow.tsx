import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight } from 'lucide-react-native';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AnimatedPressable, Badge } from '@/components/ui';
import { colors, radii, shadows, spacing, typography } from '@/theme';

import type { ExploreDiscovery } from '../types';

type DiscoveriesRowProps = {
  discoveries: ExploreDiscovery[];
  discoveredIds?: string[];
  onPressDiscovery?: (discovery: ExploreDiscovery) => void;
  onPressSeeAll?: () => void;
};

/** Falls back to a flat category color when a discovery has no imageSource
 * yet (same convention used elsewhere on this screen for missing art). */
export function DiscoveriesRow({ discoveries, discoveredIds = [], onPressDiscovery, onPressSeeAll }: DiscoveriesRowProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>{t('explore.discoveries.title')}</Text>
        <AnimatedPressable style={styles.seeAll} onPress={onPressSeeAll} accessibilityRole="button">
          <Text style={styles.seeAllText}>{t('explore.discoveries.seeAll')}</Text>
          <ChevronRight size={14} color={colors.primary} strokeWidth={2.25} />
        </AnimatedPressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.list}>
        {discoveries.map((discovery) => {
          const categoryColor = colors.discovery[discovery.category];
          const discovered = discoveredIds.includes(discovery.id);
          return (
            <AnimatedPressable
              key={discovery.id}
              style={styles.card}
              onPress={() => onPressDiscovery?.(discovery)}
              accessibilityRole="button"
              accessibilityLabel={discovery.title}
            >
              {discovery.imageSource ? (
                <Image source={discovery.imageSource} style={StyleSheet.absoluteFill} resizeMode="cover" />
              ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: categoryColor }]} />
              )}
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.6)']}
                locations={[0.45, 1]}
                style={StyleSheet.absoluteFill}
              />

              <View style={styles.topRow}>
                <Badge label={t(`explore.discoveries.categories.${discovery.category}`)} color={categoryColor} />
              </View>
              <Text style={styles.xpText}>
                {discovered ? t('explore.discoveries.discoveredLabel') : `+${discovery.xpReward} XP`}
              </Text>
            </AnimatedPressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  sectionTitle: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  list: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  card: {
    width: 150,
    height: 130,
    borderRadius: radii.xl,
    overflow: 'hidden',
    justifyContent: 'space-between',
    padding: spacing.xs,
    ...shadows.card,
  },
  topRow: {
    flexDirection: 'row',
  },
  xpText: {
    ...typography.small,
    color: colors.textOnDark,
    fontWeight: '700',
  },
});
