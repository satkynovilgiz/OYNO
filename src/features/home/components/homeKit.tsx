import { ChevronRight } from 'lucide-react-native';
import { Image, StyleSheet, Text, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable } from '@/components/ui';
import { colors, radii, spacing, typography } from '@/theme';

/**
 * The Home card system - one visual language for every Home module.
 *
 * Radius family:   compact -> radii.lg   standard -> radii.xl   hero -> radii.xxl
 * CTA hierarchy:   primary   = gold filled pill (the ONE main action of a card)
 *                  secondary = forest text link with chevron ("See all")
 *                  tertiary  = the whole card is tappable (a small chevron at most)
 * Surfaces:        tonal cream surfaces, no shadows on cards (depth comes from
 *                  image-led cards and tonal contrast); ornament as accent only.
 * Rhythm:          section title -> content: spacing.sm (12)
 *                  cards within a section: spacing.sm (12)
 *                  between major sections: spacing.xl (24+)
 */
export const HOME_RADIUS = { compact: radii.lg, standard: radii.xl, hero: radii.xxl } as const;

/** Consistent section header: optional small eyebrow, title, optional See all. */
export function HomeSectionHeader({ eyebrow, title, actionLabel, onPressAction }: { eyebrow?: string; title: string; actionLabel?: string; onPressAction?: () => void }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
      </View>
      {actionLabel && onPressAction ? <HomeTextLink label={actionLabel} onPress={onPressAction} /> : null}
    </View>
  );
}

/** Secondary CTA - forest text + chevron, 44 pt tall target. */
export function HomeTextLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <AnimatedPressable style={styles.link} onPress={onPress} hitSlop={6} accessibilityRole="button" accessibilityLabel={label}>
      <Text style={styles.linkText}>{label}</Text>
      <ChevronRight size={15} color={colors.primary} strokeWidth={2.5} />
    </AnimatedPressable>
  );
}

/** Primary CTA look (rendered inside a whole-card pressable). */
export function HomePrimaryPill({ label, large = false }: { label: string; large?: boolean }) {
  return (
    <View style={[styles.pill, large && styles.pillLarge]}>
      <Text style={[styles.pillText, large && styles.pillTextLarge]} numberOfLines={1}>
        {label}
      </Text>
      <ChevronRight size={large ? 18 : 15} color={colors.textPrimary} strokeWidth={2.5} />
    </View>
  );
}

/** Pixel width of a bundled image source, when knowable (native: asset
 * registry; web: the asset object carries width). Null = unknown. */
export function sourceWidth(source: ImageSourcePropType | null | undefined): number | null {
  if (!source) return null;
  try {
    if (typeof source === 'number') return Image.resolveAssetSource(source)?.width ?? null;
    if (!Array.isArray(source) && typeof source === 'object' && 'width' in source && typeof source.width === 'number') return source.width;
  } catch {
    // Unknown size - treat as fine.
  }
  return null;
}

/** Below this, an image can't fill a full-width card without pixelating. */
export const MIN_BACKDROP_WIDTH = 600;

/**
 * Full-bleed card artwork that never upscales a tiny asset. If `source` is
 * too small to fill the card (e.g. a 150x60 px ornament motif), the card
 * uses `backdrop` - a real, high-resolution OYNO image from the same
 * category - and shows the small image crisply as an inset swatch instead
 * of stretching it. No blur tricks, no invented images.
 */
export function HomeArtwork({ source, backdrop, style }: { source: ImageSourcePropType; backdrop?: ImageSourcePropType | null; style?: StyleProp<ViewStyle> }) {
  const width = sourceWidth(source);
  const lowRes = width !== null && width < MIN_BACKDROP_WIDTH;
  if (!lowRes || !backdrop) {
    return <Image source={source} style={[styles.fill, style as never]} resizeMode="cover" accessibilityIgnoresInvertColors />;
  }
  return (
    <View style={[styles.fill, style]}>
      <Image source={backdrop} style={styles.fill} resizeMode="cover" accessibilityIgnoresInvertColors />
      <View style={styles.swatch}>
        <OymoOrnament size={16} color={colors.accentGold} strokeWidth={1.5} />
        <Image source={source} style={styles.swatchImage} resizeMode="contain" accessibilityIgnoresInvertColors />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.sm, paddingHorizontal: spacing.md },
  headerText: { flex: 1, gap: 2 },
  eyebrow: { ...typography.overline, color: colors.accentTerracotta },
  title: { ...typography.h1, fontSize: 21, lineHeight: 26, color: colors.textPrimary },
  link: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 44 },
  linkText: { ...typography.caption, fontWeight: '700', color: colors.primary },
  pill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, minHeight: 40, paddingHorizontal: spacing.md, borderRadius: radii.pill, backgroundColor: colors.accentGold },
  pillLarge: { minHeight: 52, alignSelf: 'stretch', justifyContent: 'center' },
  pillText: { ...typography.bodyBold, fontSize: 14, color: colors.textPrimary, flexShrink: 1 },
  pillTextLarge: { fontSize: 17 },
  fill: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  swatch: { position: 'absolute', top: spacing.md, right: spacing.md, width: 104, padding: spacing.xs, gap: 4, alignItems: 'center', borderRadius: radii.lg, backgroundColor: 'rgba(251,243,227,0.94)', borderWidth: 1, borderColor: colors.accentGold },
  swatchImage: { width: 88, height: 44 },
});
