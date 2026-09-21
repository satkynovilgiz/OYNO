import { ChevronRight, Gamepad2 } from 'lucide-react-native';
import { Image, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import { colors, radii, spacing, typography } from '@/theme';
import type { CatalogItem } from '@/services/content/contentCatalog';

type SearchResultRowProps = {
  item: CatalogItem;
  categoryLabel: string;
  onPress: () => void;
};

/** One search result: thumbnail, title, small category label, optional
 * metadata, chevron (spec "Each result should have: existing artwork/
 * thumbnail, title, small category label, optional short metadata,
 * chevron"). A thin list row, distinct from the artwork-first grid cards
 * used by Saved - this screen's own spec explicitly asks for a chevron,
 * which only reads correctly in a list layout. */
export function SearchResultRow({ item, categoryLabel, onPress }: SearchResultRowProps) {
  return (
    <AnimatedPressable style={styles.row} onPress={onPress} hoverEffect accessibilityRole="button" accessibilityLabel={item.title}>
      {item.thumbnail ? (
        <Image source={item.thumbnail} style={styles.thumbnail} resizeMode="cover" />
      ) : (
        <View style={[styles.thumbnail, styles.thumbnailFallback]}>
          <Gamepad2 size={20} color={colors.accentGold} strokeWidth={1.75} />
        </View>
      )}

      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.category} numberOfLines={1}>
            {categoryLabel}
          </Text>
          {item.metadata ? (
            <>
              <View style={styles.dot} />
              <Text style={styles.metadata} numberOfLines={1}>
                {item.metadata}
              </Text>
            </>
          ) : null}
        </View>
      </View>

      <ChevronRight size={18} color={colors.textMuted} strokeWidth={2} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  thumbnail: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
  },
  thumbnailFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  category: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.textMuted,
  },
  metadata: {
    ...typography.caption,
    color: colors.textMuted,
    flexShrink: 1,
  },
});
