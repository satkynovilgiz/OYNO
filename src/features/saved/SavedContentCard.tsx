import { CloudDownload, Heart } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { LibraryArt } from '@/components/library/LibraryContentRow';
import { contentTypeMeta } from '@/components/library/contentTypeMeta';
import { AnimatedPressable } from '@/components/ui';
import type { AgeExperience } from '@/services/ageExperience/types';
import type { CatalogItem } from '@/services/content/contentCatalog';
import { cardRadii, colors, editorial, spacing, textStyles } from '@/theme';

type Props = {
  item: CatalogItem;
  offline: boolean;
  experience: AgeExperience;
  /** `tile` = visual collection card (2 per row, preteen / Continue rail);
   * `row` = medium-density library card (everyone else). */
  layout?: 'row' | 'tile';
  onOpen: () => void;
  onRemove: () => void;
};

/**
 * The one Saved card: artwork, the content type (a human label - never an
 * internal content-type string), the title (two lines, long RU/KG titles
 * wrap instead of clipping), optional short metadata, a quiet "Available
 * offline" mark when a complete download exists, and ONE control - the
 * filled heart that removes it from Saved.
 *
 * Age: child = bigger art, no metadata; preteen = visual tile;
 * teen = compact row; adult = editorial serif title.
 */
export function SavedContentCard({ item, offline, experience, layout = 'row', onOpen, onRemove }: Props) {
  const { t } = useTranslation();
  const meta = contentTypeMeta(item.contentType);
  const typeLabel = t(meta.labelKey);
  const typeColor = meta.tone === colors.surfaceFeature ? colors.primary : meta.tone;
  const isChild = experience === 'child';
  const isAdult = experience === 'adult';
  const showMeta = !!item.metadata && !isChild;
  const a11y = [item.title, typeLabel, !isChild && item.metadata ? item.metadata : null, t('library.status.saved'), offline ? t('library.status.offline') : null].filter(Boolean).join(', ');
  const removeLabel = t('saved.v2.removeA11y', { title: item.title });

  const heart = (
    <AnimatedPressable style={[styles.heart, layout === 'tile' && styles.heartOnArt]} onPress={onRemove} haptic="light" hitSlop={4} accessibilityRole="button" accessibilityLabel={removeLabel}>
      <Heart size={layout === 'tile' ? 16 : 19} color={colors.accentTerracotta} fill={colors.accentTerracotta} strokeWidth={0} />
    </AnimatedPressable>
  );

  const offlineMark = offline ? (
    <View style={styles.offline}>
      <CloudDownload size={12} color={colors.primary} strokeWidth={2.5} />
      <Text style={styles.offlineText} numberOfLines={1}>
        {t('offline.available')}
      </Text>
    </View>
  ) : null;

  if (layout === 'tile') {
    return (
      <View style={styles.tile}>
        <AnimatedPressable onPress={onOpen} press="soft" accessibilityRole="button" accessibilityLabel={a11y} style={styles.tileMain}>
          <LibraryArt item={item} size="100%" radius={cardRadii.compact} />
          <Text style={[styles.type, { color: typeColor }]} numberOfLines={1}>
            {typeLabel}
          </Text>
          <Text style={[styles.tileTitle, isChild && styles.titleChild]} numberOfLines={2}>
            {item.title}
          </Text>
          {offlineMark}
        </AnimatedPressable>
        {heart}
      </View>
    );
  }

  const artSize = isChild ? 104 : experience === 'teen' ? 76 : 88;
  return (
    <View style={styles.row}>
      <AnimatedPressable onPress={onOpen} press="soft" hoverEffect accessibilityRole="button" accessibilityLabel={a11y} style={styles.rowMain}>
        <LibraryArt item={item} size={artSize} radius={cardRadii.chip} />
        <View style={styles.text}>
          <Text style={[styles.type, { color: typeColor }]} numberOfLines={1}>
            {typeLabel}
          </Text>
          <Text style={[styles.title, isChild && styles.titleChild, isAdult && styles.titleAdult]} numberOfLines={2}>
            {item.title}
          </Text>
          {showMeta ? (
            <Text style={styles.meta} numberOfLines={1}>
              {item.metadata}
            </Text>
          ) : null}
          {offlineMark}
        </View>
      </AnimatedPressable>
      {heart}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', padding: spacing.xs, paddingRight: 0, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  text: { flex: 1, gap: 3, paddingVertical: 2 },
  type: { ...textStyles.overline, fontSize: 11 },
  title: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  titleChild: { fontSize: 18, lineHeight: 24 },
  titleAdult: { ...editorial(textStyles.title), fontSize: 18, lineHeight: 23 },
  meta: { ...textStyles.small, color: colors.textMuted },
  offline: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  offlineText: { ...textStyles.small, fontWeight: '700', color: colors.primary, flexShrink: 1 },
  heart: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  heartOnArt: { position: 'absolute', top: 6, right: 6, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,253,247,0.92)' },
  tile: { flex: 1 },
  tileMain: { gap: 4 },
  tileTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
});
