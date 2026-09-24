import { useTranslation } from 'react-i18next';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable } from '@/components/ui';
import type { RecentDisplay } from '@/features/home/useHomeRecommendation';
import { colors, radii, spacing, typography } from '@/theme';

/**
 * Real recent history (destination visits, completed Daily OYNO days) as a
 * light, secondary row of compact pills - small image + title, nothing
 * else. Scrolls horizontally with proper end padding; renders nothing when
 * there's no real history.
 */
export function RecentlyExploredRow({ items, onPress }: { items: RecentDisplay[]; onPress: (route: string) => void }) {
  const { t } = useTranslation();
  if (items.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.title}>{t('home.journey.recentlyExplored')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {items.map((item) => (
          <AnimatedPressable key={item.key} style={styles.pill} onPress={() => onPress(item.route)} pressScale={0.97} accessibilityRole="button" accessibilityLabel={item.title}>
            {item.imageSource ? (
              <Image source={item.imageSource} style={styles.thumb} resizeMode="cover" />
            ) : (
              <View style={[styles.thumb, styles.thumbFallback]}>
                <OymoOrnament size={14} color={colors.accentGold} strokeWidth={1.5} />
              </View>
            )}
            <Text style={styles.pillTitle} numberOfLines={1}>
              {item.title}
            </Text>
          </AnimatedPressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.xs },
  title: { ...typography.overline, color: colors.textSecondary, paddingHorizontal: spacing.md },
  row: { paddingHorizontal: spacing.md, gap: spacing.xs },
  pill: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 44, maxWidth: 220, paddingLeft: 4, paddingRight: spacing.sm, borderRadius: radii.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder, flexShrink: 0 },
  thumb: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceAlt },
  thumbFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  pillTitle: { ...typography.caption, fontWeight: '600', color: colors.textPrimary, flexShrink: 1 },
});
