import { Children, type ReactNode } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';

import { spacing } from '@/theme';

/**
 * Shared horizontal carousel (design system v2). Item widths are a share of
 * the *content* width (screen minus both gutters), so the next card always
 * peeks naturally at 375-430 pt:
 *
 *   compact  ~46%  two readable tiles (games)
 *   medium   ~70%  one destination card + a clear peek (Explore)
 *   feature  ~86%  one dominant card + a sliver
 *
 * Start/end padding equals the screen gutter so the first card aligns with
 * the page and the last one is never clipped. No pagination dots. Snapping
 * is opt-in (for medium/feature rails where one-card-at-a-time reads well).
 */
export type RailPreset = 'compact' | 'medium' | 'feature';

const SHARE: Record<RailPreset, number> = { compact: 0.46, medium: 0.7, feature: 0.86 };
const MAX_WIDTH: Record<RailPreset, number> = { compact: 200, medium: 320, feature: 400 };

export const RAIL_GAP = spacing.sm;

/** Pixel width for one rail item. `share` overrides the preset share (age
 * tuning); the result is capped so large phones don't get giant cards. */
export function railItemWidth(screenWidth: number, preset: RailPreset, share?: number): number {
  const content = screenWidth - spacing.md * 2;
  return Math.round(Math.min(content * (share ?? SHARE[preset]), MAX_WIDTH[preset]));
}

export function useRailItemWidth(preset: RailPreset, share?: number): number {
  return railItemWidth(useWindowDimensions().width, preset, share);
}

export function Rail({ children, itemWidth, snap = false, gap = RAIL_GAP, style, accessibilityLabel }: { children: ReactNode; itemWidth?: number; snap?: boolean; gap?: number; style?: StyleProp<ViewStyle>; accessibilityLabel?: string }) {
  const snapProps = snap && itemWidth ? { snapToInterval: itemWidth + gap, snapToAlignment: 'start' as const, decelerationRate: 'fast' as const, disableIntervalMomentum: true } : {};
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.row, { gap }]}
      style={style}
      accessibilityLabel={accessibilityLabel}
      {...snapProps}
    >
      {Children.map(children, (child) => (child === null || child === undefined || child === false ? null : <View style={styles.item}>{child}</View>))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: spacing.md },
  item: { flexShrink: 0 },
});
