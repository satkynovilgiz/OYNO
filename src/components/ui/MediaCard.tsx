import type { ImageContentPosition } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';

import { colors, cardRadii, editorial, radii, spacing, textStyles } from '@/theme';

import { AnimatedPressable } from './AnimatedPressable';
import { MediaImage } from './MediaImage';

/**
 * Media card family (design system v2) - ONE component, four roles:
 *
 *   hero       the single primary card of a screen (~3:2), h1 title
 *   landscape  wide editorial card (~16:9), h2 title
 *   portrait   carousel destination card, h3 title
 *   compact    small tile (games), title-size title
 *
 * Each: full-bleed photo, forest scrim, optional eyebrow chip, status slot
 * (top-right), title, subtitle, footer slot (progress etc.) and an optional
 * CTA pill. The whole card is the touch target; the CTA is only its visual
 * affordance - never a second competing button.
 */
export type MediaCardVariant = 'hero' | 'landscape' | 'portrait' | 'compact';

const VARIANT = {
  hero: { radius: cardRadii.hero, pad: spacing.lg, title: textStyles.h1, aspect: 1.5 },
  landscape: { radius: cardRadii.media, pad: spacing.md, title: textStyles.h2, aspect: 16 / 9 },
  portrait: { radius: cardRadii.media, pad: spacing.md, title: textStyles.h3, aspect: 0.82 },
  compact: { radius: cardRadii.compact, pad: spacing.sm, title: textStyles.title, aspect: 1 },
} as const;

type MediaCardProps = {
  variant: MediaCardVariant;
  /** Photo; optional only when `artwork` is supplied. */
  source?: ImageSourcePropType | null;
  /** High-res same-category photo used when `source` is too small. */
  backdrop?: ImageSourcePropType | null;
  imagePosition?: ImageContentPosition;
  /** Replaces the photo entirely (e.g. game art with its own fallback). */
  artwork?: ReactNode;
  eyebrow?: string;
  eyebrowIcon?: ReactNode;
  title: string;
  titleLines?: number;
  subtitle?: string;
  subtitleLines?: number;
  /** Top-right slot (small status chip / play mark). */
  status?: ReactNode;
  /** Below the subtitle (progress, metadata). */
  footer?: ReactNode;
  cta?: string;
  ctaSize?: CtaSize;
  /** 'below' stacks the CTA under the text; 'inline' puts it at the right
   * of the footer row (keeps wide cards short). */
  ctaPlacement?: 'below' | 'inline';
  /** Small chevron after the title (tertiary affordance). */
  chevron?: boolean;
  editorialTitle?: boolean;
  width?: number;
  /** Grows with content instead of a fixed aspect ratio. */
  minHeight?: number;
  aspectRatio?: number;
  onPress?: () => void;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
};

export function MediaCard({
  variant,
  source,
  backdrop,
  imagePosition,
  artwork,
  eyebrow,
  eyebrowIcon,
  title,
  titleLines = 2,
  subtitle,
  subtitleLines = 1,
  status,
  footer,
  cta,
  ctaSize = 'md',
  ctaPlacement = 'below',
  chevron = false,
  editorialTitle = false,
  width,
  minHeight,
  aspectRatio,
  onPress,
  accessibilityLabel,
  style,
}: MediaCardProps) {
  const v = VARIANT[variant];
  const sizing: ViewStyle = minHeight ? { minHeight } : { aspectRatio: aspectRatio ?? v.aspect };
  const inlineCta = cta && ctaPlacement === 'inline';
  const topScrim = variant === 'hero' || variant === 'landscape' || !!eyebrow;

  return (
    <AnimatedPressable
      style={[styles.card, { borderRadius: v.radius }, sizing, width !== undefined && { width }, style]}
      onPress={onPress}
      disabled={!onPress}
      press="soft"
      haptic={onPress ? 'light' : false}
      accessibilityRole="button"
      accessibilityState={{ disabled: !onPress }}
      accessibilityLabel={accessibilityLabel}
    >
      {artwork ?? (source ? <MediaImage source={source} backdrop={backdrop} position={imagePosition} /> : null)}
      <LinearGradient
        colors={topScrim ? [colors.scrimTop, colors.scrimClear, colors.scrimBottom] : [colors.scrimClear, colors.scrimBottom]}
        locations={topScrim ? [0, 0.32, 1] : [0.4, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={[styles.content, { padding: v.pad }]} pointerEvents="box-none">
        <View style={styles.topRow}>
          {eyebrow ? (
            <View style={styles.eyebrow}>
              {eyebrowIcon}
              <Text style={styles.eyebrowText} numberOfLines={1}>
                {eyebrow}
              </Text>
            </View>
          ) : (
            <View />
          )}
          {status}
        </View>

        <View style={styles.bottom}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, editorialTitle ? editorial(v.title) : v.title]} numberOfLines={titleLines}>
              {title}
            </Text>
            {chevron ? <ChevronRight size={18} color={colors.accentGold} strokeWidth={2.5} style={styles.chevron} /> : null}
          </View>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={subtitleLines}>
              {subtitle}
            </Text>
          ) : null}
          {inlineCta || footer ? (
            <View style={[styles.footerRow, inlineCta ? styles.footerInline : null]}>
              {footer ? <View style={styles.footer}>{footer}</View> : <View style={styles.footer} />}
              {inlineCta ? <CtaPill label={cta} size={ctaSize} /> : null}
            </View>
          ) : null}
          {cta && !inlineCta ? (
            <View style={styles.ctaBelow}>
              <CtaPill label={cta} size={ctaSize} stretch={ctaSize === 'lg'} />
            </View>
          ) : null}
        </View>
      </View>
    </AnimatedPressable>
  );
}

export type CtaSize = 'sm' | 'md' | 'lg';

const CTA = {
  sm: { minHeight: 36, paddingHorizontal: spacing.sm + 2, text: textStyles.caption },
  md: { minHeight: 44, paddingHorizontal: spacing.md + 2, text: textStyles.bodyMedium },
  lg: { minHeight: 52, paddingHorizontal: spacing.lg, text: textStyles.title },
} as const;

/** Primary CTA look (gold fill, dark text) drawn inside a pressable card.
 * No arrow - the label is the affordance. */
export function CtaPill({ label, size = 'md', stretch = false }: { label: string; size?: CtaSize; stretch?: boolean }) {
  const c = CTA[size];
  return (
    <View style={[styles.cta, { minHeight: c.minHeight, paddingHorizontal: c.paddingHorizontal }, stretch && styles.ctaStretch]}>
      <Text style={[c.text, styles.ctaText]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden', backgroundColor: colors.surfaceFeature, flexShrink: 0 },
  content: { flex: 1, justifyContent: 'space-between', gap: spacing.sm },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.xs },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.pill, backgroundColor: colors.chipOnDark },
  eyebrowText: { ...textStyles.overline, color: colors.accentGold, flexShrink: 1 },
  bottom: { gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  title: { color: colors.textOnDark, flexShrink: 1 },
  chevron: { flexShrink: 0 },
  subtitle: { ...textStyles.caption, fontSize: 14, lineHeight: 19, color: colors.textOnDarkSecondary },
  footerRow: { marginTop: spacing.xs },
  footerInline: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  footer: { flex: 1, minWidth: 0 },
  ctaBelow: { marginTop: spacing.sm, flexDirection: 'row' },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start', borderRadius: radii.pill, backgroundColor: colors.accentGold, flexShrink: 0 },
  ctaStretch: { flex: 1 },
  ctaText: { color: colors.textPrimary, fontWeight: '700' },
});
