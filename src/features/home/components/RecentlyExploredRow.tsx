import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import type { RecentDisplay } from '@/features/home/useHomeRecommendation';
import { colors, radii, spacing, typography } from '@/theme';

/** Up to 3 genuinely recent, dated things (destination visits, completed
 * Daily OYNO days) - nothing is shown when there's no real history. */
export function RecentlyExploredRow({ items, onPress }: { items: RecentDisplay[]; onPress: (route: string) => void }) {
  const { t } = useTranslation();
  if (items.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.title}>{t('home.journey.recentlyExplored')}</Text>
      <View style={styles.row}>
        {items.map((item) => (
          <AnimatedPressable key={item.key} style={styles.item} onPress={() => onPress(item.route)} hoverEffect accessibilityRole="button" accessibilityLabel={item.title}>
            {item.imageSource ? <Image source={item.imageSource} style={styles.thumb} resizeMode="cover" /> : <View style={styles.thumb} />}
            <Text style={styles.itemTitle} numberOfLines={2}>
              {item.title}
            </Text>
          </AnimatedPressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.xs },
  title: { ...typography.overline, color: colors.textSecondary },
  row: { flexDirection: 'row', gap: spacing.sm },
  item: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, padding: spacing.xs, borderRadius: radii.lg, backgroundColor: colors.surface },
  thumb: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceAlt },
  itemTitle: { ...typography.small, color: colors.textPrimary, flex: 1 },
});
