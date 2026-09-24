import { ArrowDownToLine, ChevronRight, Heart } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable } from '@/components/ui';
import type { AgeExperience } from '@/services/ageExperience/types';
import type { CatalogContentType } from '@/services/content/contentCatalog';
import { colors, fontFamily, radii, spacing, typography } from '@/theme';

import { contentTypeMeta } from './contentTypeMeta';

export type LibraryItem = {
  contentType: CatalogContentType;
  id: string;
  title: string;
  subtitle?: string | null;
  thumbnail: ImageSourcePropType | null;
};

/** Artwork, or a tasteful tonal oymo tile in the content type's colour. */
export function LibraryArt({ item, size, radius }: { item: LibraryItem; size: number | '100%'; radius: number }) {
  const [failed, setFailed] = useState(false);
  const meta = contentTypeMeta(item.contentType);
  const Icon = meta.icon;
  // A fixed-ratio frame with the image filling it - the frame, not the
  // image's own intrinsic size, decides the card height on every platform.
  const frame = size === '100%' ? ({ width: '100%', aspectRatio: 1.3, borderRadius: radius } as const) : { width: size, height: size, borderRadius: radius };
  if (item.thumbnail && !failed) {
    return (
      <View style={[styles.art, frame]}>
        <Image source={item.thumbnail} style={styles.fill} resizeMode="cover" onError={() => setFailed(true)} accessibilityIgnoresInvertColors />
      </View>
    );
  }
  return (
    <View style={[styles.art, styles.fallback, frame, { backgroundColor: meta.tone }]}>
      <OymoOrnament size={typeof size === 'number' ? size * 0.7 : 64} color="rgba(251,243,227,0.18)" strokeWidth={1.25} />
      <Icon size={typeof size === 'number' ? Math.max(18, size * 0.32) : 28} color="rgba(251,243,227,0.9)" strokeWidth={1.75} style={styles.fallbackIcon} />
    </View>
  );
}

/**
 * The one premium content row for "Your OYNO" (Search, Saved, Offline):
 * artwork first, a title that may wrap to two lines (long Kyrgyz/Russian
 * titles never clip early), the content type, an optional short subtitle,
 * and SUBTLE state marks - a small heart when saved, a small download mark
 * when available offline. One tap target (the row); an optional single
 * trailing control (e.g. unsave / remove download) - never a row of buttons.
 *
 * Age: child = larger art and text; preteen = visual card (use
 * `LibraryContentCard`); teen = compact media-rich row; adult = calm
 * editorial row (serif title).
 */
export function LibraryContentRow({
  item,
  experience,
  saved = false,
  offline = false,
  onPress,
  trailing,
}: {
  item: LibraryItem;
  experience: AgeExperience;
  saved?: boolean;
  offline?: boolean;
  onPress: () => void;
  /** One optional control after the text (replaces the chevron). */
  trailing?: ReactNode;
}) {
  const { t } = useTranslation();
  const meta = contentTypeMeta(item.contentType);
  const isChild = experience === 'child';
  const isAdult = experience === 'adult';
  const artSize = isChild ? 76 : experience === 'teen' ? 60 : 64;
  const typeLabel = t(meta.labelKey);
  const status = [saved ? t('library.status.saved') : null, offline ? t('library.status.offline') : null].filter(Boolean).join(', ');

  return (
    <View style={styles.row}>
      <AnimatedPressable
        style={styles.main}
        onPress={onPress}
        pressScale={0.985}
        hoverEffect
        accessibilityRole="button"
        accessibilityLabel={`${item.title}, ${typeLabel}${item.subtitle ? `, ${item.subtitle}` : ''}${status ? `, ${status}` : ''}`}
      >
        <LibraryArt item={item} size={artSize} radius={isChild ? radii.xl : radii.lg} />
        <View style={styles.text}>
          <Text style={[styles.title, isChild && styles.titleChild, isAdult && styles.titleAdult]} numberOfLines={2}>
            {item.title}
          </Text>
          <View style={styles.metaRow}>
            <Text style={[styles.type, { color: meta.tone === colors.surfaceFeature ? colors.primary : meta.tone }]} numberOfLines={1}>
              {typeLabel}
            </Text>
            {item.subtitle && !isChild ? (
              <Text style={styles.subtitle} numberOfLines={1}>
                {` · ${item.subtitle}`}
              </Text>
            ) : null}
            {saved ? <Heart size={11} color={colors.accentTerracotta} fill={colors.accentTerracotta} strokeWidth={0} style={styles.mark} /> : null}
            {offline ? <ArrowDownToLine size={12} color={colors.primary} strokeWidth={2.5} style={styles.mark} /> : null}
          </View>
        </View>
        {trailing ? null : <ChevronRight size={18} color={colors.textMuted} strokeWidth={2} />}
      </AnimatedPressable>
      {trailing}
    </View>
  );
}

/** Preteen "visual card" variant of the same item (two per row). */
export function LibraryContentCard({ item, saved = false, offline = false, onPress }: { item: LibraryItem; saved?: boolean; offline?: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  const meta = contentTypeMeta(item.contentType);
  return (
    <AnimatedPressable style={styles.card} onPress={onPress} pressScale={0.97} hoverEffect accessibilityRole="button" accessibilityLabel={`${item.title}, ${t(meta.labelKey)}`}>
      <LibraryArt item={item} size="100%" radius={radii.lg} />
      <Text style={styles.cardTitle} numberOfLines={2}>
        {item.title}
      </Text>
      <View style={styles.metaRow}>
        <Text style={[styles.type, { color: meta.tone === colors.surfaceFeature ? colors.primary : meta.tone }]} numberOfLines={1}>
          {t(meta.labelKey)}
        </Text>
        {saved ? <Heart size={11} color={colors.accentTerracotta} fill={colors.accentTerracotta} strokeWidth={0} style={styles.mark} /> : null}
        {offline ? <ArrowDownToLine size={12} color={colors.primary} strokeWidth={2.5} style={styles.mark} /> : null}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  art: { backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  fill: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  fallbackIcon: { position: 'absolute' },
  text: { flex: 1, gap: 3 },
  title: { ...typography.bodyBold, lineHeight: 21, color: colors.textPrimary },
  titleChild: { fontSize: 18, lineHeight: 24 },
  titleAdult: { fontFamily: fontFamily.wordmark, fontSize: 17, lineHeight: 22 },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  type: { ...typography.small, fontWeight: '700', flexShrink: 0 },
  subtitle: { ...typography.small, fontWeight: '500', color: colors.textMuted, flexShrink: 1 },
  mark: { marginLeft: 6 },
  card: { flex: 1, gap: spacing.xxs },
  cardTitle: { ...typography.bodyBold, color: colors.textPrimary, marginTop: spacing.xxs },
});
