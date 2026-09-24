import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable, Rail, SectionHeader } from '@/components/ui';
import type { RecentDisplay } from '@/features/home/useHomeRecommendation';
import { colors, radii, spacing, textStyles } from '@/theme';

/**
 * Real recent history (destination visits, completed Daily OYNO days) as a
 * light tertiary row of compact pills - round thumbnail + title. Scrolls on
 * the shared Rail (gutter-aligned, last pill never clipped); renders
 * nothing when there's no real history.
 */
export function RecentlyExploredRow({ items, onPress }: { items: RecentDisplay[]; onPress: (route: string) => void }) {
  const { t } = useTranslation();
  if (items.length === 0) return null;

  return (
    <View style={styles.section}>
      <SectionHeader title={t('home.journey.recentlyExplored')} size="sm" />
      <Rail gap={spacing.xs}>
        {items.map((item) => (
          <AnimatedPressable key={item.key} style={styles.pill} onPress={() => onPress(item.route)} press="strong" accessibilityRole="button" accessibilityLabel={item.title}>
            {item.imageSource ? (
              <Image source={item.imageSource} style={styles.thumb} resizeMode="cover" />
            ) : (
              <View style={[styles.thumb, styles.thumbFallback]}>
                <OymoOrnament size={12} color={colors.accentGold} strokeWidth={1.5} />
              </View>
            )}
            <Text style={styles.title} numberOfLines={1}>
              {item.title}
            </Text>
          </AnimatedPressable>
        ))}
      </Rail>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.xs },
  pill: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 44, maxWidth: 220, paddingLeft: 6, paddingRight: spacing.sm + 2, borderRadius: radii.pill, backgroundColor: colors.surfaceElevated },
  thumb: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceMuted },
  thumbFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  title: { ...textStyles.caption, fontSize: 14, fontWeight: '700', color: colors.textPrimary, flexShrink: 1 },
});
