import { ChevronRight, CloudDownload, Heart } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { LibraryArt } from '@/components/library/LibraryContentRow';
import { contentTypeMeta } from '@/components/library/contentTypeMeta';
import { AnimatedPressable } from '@/components/ui';
import type { CatalogItem } from '@/services/content/contentCatalog';
import { highlightRange } from '@/services/search/globalSearch';
import { cardRadii, colors, spacing, textStyles } from '@/theme';

/**
 * One compact search result: thumbnail (or the type's tonal tile), the
 * title with the matched part subtly bolder, "Type · metadata", and quiet
 * saved / offline marks - no buttons in the row. `large` = child sizing.
 */
export function SearchResultRow({ item, query, saved, offline, large = false, onPress }: { item: CatalogItem; query: string; saved: boolean; offline: boolean; large?: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  const meta = contentTypeMeta(item.contentType);
  const typeLabel = t(meta.labelKey);
  const range = highlightRange(item.title, query);
  const title = item.title.normalize('NFC');
  const a11y = [item.title, typeLabel, item.metadata, saved ? t('library.status.saved') : null, offline ? t('library.status.offline') : null].filter(Boolean).join(', ');

  return (
    <AnimatedPressable style={styles.row} onPress={onPress} press="soft" hoverEffect accessibilityRole="button" accessibilityLabel={a11y}>
      <LibraryArt item={item} size={large ? 68 : 52} radius={large ? cardRadii.chip : 12} />
      <View style={styles.text}>
        <Text style={[styles.title, large && styles.titleLarge]} numberOfLines={2}>
          {range ? (
            <>
              {title.slice(0, range[0])}
              <Text style={styles.match}>{title.slice(range[0], range[1])}</Text>
              {title.slice(range[1])}
            </>
          ) : (
            title
          )}
        </Text>
        <View style={styles.metaRow}>
          <Text style={[styles.type, { color: meta.tone === colors.surfaceFeature ? colors.primary : meta.tone }]} numberOfLines={1}>
            {typeLabel}
          </Text>
          {item.metadata && !large ? (
            <Text style={styles.meta} numberOfLines={1}>
              {`\u00A0·\u00A0${item.metadata}`}
            </Text>
          ) : null}
          {saved ? <Heart size={11} color={colors.accentTerracotta} fill={colors.accentTerracotta} strokeWidth={0} style={styles.mark} /> : null}
          {offline ? <CloudDownload size={12} color={colors.primary} strokeWidth={2.5} style={styles.mark} /> : null}
        </View>
      </View>
      <ChevronRight size={16} color={colors.textMuted} strokeWidth={2} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6, minHeight: 56 },
  text: { flex: 1, gap: 2 },
  title: { ...textStyles.bodyMedium, color: colors.textPrimary },
  titleLarge: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  match: { fontWeight: '800', color: colors.textPrimary },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  type: { ...textStyles.small, fontWeight: '700', flexShrink: 0 },
  meta: { ...textStyles.small, color: colors.textMuted, flexShrink: 1 },
  mark: { marginLeft: 6 },
});
