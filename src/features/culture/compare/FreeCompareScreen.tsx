import { router } from 'expo-router';
import { ArrowLeftRight, ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KyrgyzOnlyNote } from '@/components/content/KyrgyzOnlyNote';
import { SourcesAndNotes } from '@/components/content/SourcesAndNotes';
import { OfflineUnavailable } from '@/components/offline/OfflineUnavailable';
import { AnimatedPressable, Button, IconButton, MediaImage } from '@/components/ui';
import { cultureItemImages } from '@/features/culture/data';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { useAllCultureItems } from '@/services/content/cultureItemsService';
import type { CultureItemRow } from '@/services/content/types';
import { isWaitingForNetwork } from '@/services/offline/offlineManifest';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { choices, choose, FREE_LABEL_KEY, freeCompareRows, pairConnections, swap, type Pair, type Side } from './freeCompare';

const PICK_LIMIT = 40;
const imageOf = (id: string): ImageSourcePropType | null => cultureItemImages[id]?.[0] ?? null;
const FIELD_LABEL: Record<string, string> = {
  origin: 'culture.item.originLabel',
  history: 'culture.item.historyLabel',
  cultural_meaning: 'culture.item.culturalMeaningLabel',
  traditional_method: 'culture.item.traditionalMethodLabel',
  objects_used: 'culture.item.objectsUsedLabel',
};

/**
 * /culture/compare/pick?left=<id>&right=<id> - compare ANY two culture
 * items (freeCompare.ts). The pair is kept in the route, so opening a
 * source article and coming back keeps it; nothing is stored. Two columns
 * on wide screens, paired sections on phones.
 */
export function FreeCompareScreen({ pair, onPressBack }: { pair: Pair; onPressBack: () => void }) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { experience } = useAgeExperience();
  const large = experience === 'child';
  const query = useAllCultureItems();
  const [picking, setPicking] = useState<Side | null>(pair.left ? (pair.right ? null : 'right') : 'left');
  const [search, setSearch] = useState('');
  const wide = width >= 768;

  if (isWaitingForNetwork(query)) return <OfflineUnavailable onRetry={() => void query.refetch()} />;
  const items = query.data ?? [];
  const byId = (id: string | null) => (id ? (items.find((item) => item.id === id) ?? null) : null);
  const left = byId(pair.left);
  const right = byId(pair.right);
  const loading = !query.data;
  const sideName = (side: Side) => t(side === 'left' ? 'compare.free.left' : 'compare.free.right');

  const update = (next: Pair) => {
    router.setParams({ left: next.left ?? undefined, right: next.right ?? undefined } as never);
  };
  const pick = (side: Side, id: string) => {
    update(choose(pair, side, id));
    setPicking(null);
    setSearch('');
  };

  const slot = (side: Side, item: CultureItemRow | null, id: string | null) => (
    <View style={[styles.slot, wide && styles.slotWide]} testID={`fc-slot-${side}`}>
      <Text style={styles.section}>{sideName(side)}</Text>
      {item ? (
        <View style={styles.slotRow} accessible accessibilityLabel={t('compare.free.slotA11y', { side: sideName(side), title: item.title })}>
          <View style={styles.thumb}>{imageOf(item.id) ? <MediaImage source={imageOf(item.id)!} /> : null}</View>
          <Text style={[styles.slotTitle, large && styles.bodyLarge]} numberOfLines={3}>
            {item.title}
          </Text>
        </View>
      ) : id && !loading ? (
        <Text style={styles.body} testID={`fc-missing-${side}`}>
          {t('compare.free.missing')}
        </Text>
      ) : (
        <Text style={styles.meta}>{t('compare.free.empty')}</Text>
      )}
      <Button label={id ? t('compare.free.replace') : t('compare.free.choose')} variant="secondary" onPress={() => setPicking(side)} accessibilityHint={sideName(side)} testID={`fc-choose-${side}`} />
    </View>
  );

  const comparison = left && right ? freeCompareRows(left, right) : null;
  const links = left && right ? pairConnections(left.id, right.id) : [];

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
          {t('compare.free.title')}
        </Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} keyboardShouldPersistTaps="handled">
        <Text style={[styles.body, large && styles.bodyLarge]}>{t('compare.free.intro')}</Text>

        <View style={[styles.slots, wide && styles.slotsWide]}>
          {slot('left', left, pair.left)}
          {slot('right', right, pair.right)}
        </View>
        {pair.left && pair.right ? <Button label={t('compare.free.swap')} variant="text" icon={<ArrowLeftRight size={16} color={colors.primary} />} onPress={() => update(swap(pair))} testID="fc-swap" /> : null}

        {picking ? (
          <View style={styles.picker} testID="fc-picker">
            <Text style={styles.cardTitle} accessibilityRole="header">
              {t('compare.free.pickTitle', { side: sideName(picking) })}
            </Text>
            <TextInput value={search} onChangeText={setSearch} placeholder={t('compare.free.searchLabel')} placeholderTextColor={colors.textMuted} accessibilityLabel={t('compare.free.searchLabel')} style={styles.input} testID="fc-search" />
            {loading ? <ActivityIndicator color={colors.primary} /> : null}
            {(() => {
              const list = choices(items, search, null).slice(0, PICK_LIMIT);
              if (!loading && list.length === 0) return <Text style={styles.meta}>{t('compare.free.noMatches')}</Text>;
              return list.map((item) => (
                <AnimatedPressable key={item.id} style={[styles.choice, item.id === pair[picking] && styles.choiceOn]} onPress={() => pick(picking, item.id)} accessibilityRole="button" accessibilityLabel={item.title} testID={`fc-pick-${item.id}`}>
                  <View style={styles.thumbSmall}>{imageOf(item.id) ? <MediaImage source={imageOf(item.id)!} /> : null}</View>
                  <Text style={[styles.body, styles.flex]} numberOfLines={2}>
                    {item.title}
                  </Text>
                </AnimatedPressable>
              ));
            })()}
            {pair.left || pair.right ? <Button label={t('compare.free.cancel')} variant="text" onPress={() => setPicking(null)} /> : null}
          </View>
        ) : null}

        {!comparison && !picking ? <Text style={styles.meta}>{t('compare.free.pickBoth')}</Text> : null}

        {comparison && left && right ? (
          <View style={styles.stack} testID="fc-comparison">
            {[left, right].map((item) =>
              i18n.language !== 'kg' && item.translation?.status === 'fallback_to_kg' ? (
                <View key={item.id} style={styles.kgNote}>
                  <Text style={styles.sideTitle}>{item.title}</Text>
                  <KyrgyzOnlyNote status={item.translation?.status} language={i18n.language} />
                </View>
              ) : null,
            )}
            {comparison.rows.map((row) => {
              const label = t(FREE_LABEL_KEY[row.field]);
              return (
                <View key={row.field} style={styles.field} testID={`fc-row-${row.field}`}>
                  <Text style={styles.fieldHeading} accessibilityRole="header">
                    {label}
                  </Text>
                  <View style={[styles.sides, wide && styles.sidesWide]}>
                    <SideText title={left.title} label={label} text={row.left} tone="left" wide={wide} large={large} testID={`fc-${row.field}-left`} />
                    <SideText title={right.title} label={label} text={row.right} tone="right" wide={wide} large={large} testID={`fc-${row.field}-right`} />
                  </View>
                </View>
              );
            })}
            {comparison.neither.length > 0 ? <Text style={styles.meta}>{t('compare.free.neitherNote', { fields: comparison.neither.map((field) => t(FREE_LABEL_KEY[field])).join(', ') })}</Text> : null}

            {/* Only connections the curated data explicitly has for this pair. */}
            <View style={styles.card} testID="fc-connections">
              <Text style={styles.cardTitle} accessibilityRole="header">
                {t('compare.free.connectionsTitle')}
              </Text>
              {links.length === 0 ? <Text style={styles.meta}>{t('compare.free.noConnection')}</Text> : null}
              {links.map(({ connection, labelKey }) => {
                const source = byId(connection.source.contentId);
                return (
                  <View key={connection.id} style={styles.link} testID={`fc-link-${connection.id}`}>
                    <Text style={styles.bodyBold}>
                      {left.title} · {t(`culture.connections.relation.${labelKey}`)} · {right.title}
                    </Text>
                    <Text style={styles.quote}>“{connection.evidence}”</Text>
                    <Text style={styles.meta}>{t('culture.connections.fromArticle', { title: source?.title ?? connection.source.contentId, section: FIELD_LABEL[connection.source.field] ? t(FIELD_LABEL[connection.source.field]) : connection.source.field })}</Text>
                  </View>
                );
              })}
            </View>

            <View style={[styles.sides, wide && styles.sidesWide]}>
              {[left, right].map((item) => (
                <View key={`sources-${item.id}`} style={[styles.sources, wide && styles.flex]}>
                  <Text style={styles.cardTitle} accessibilityRole="header">
                    {t('compare.free.sourcesTitle', { title: item.title })}
                  </Text>
                  <SourcesAndNotes contentType="culture_item" level={item.accuracy_level} sources={item.sources} contentId={item.id} />
                  <Button label={t('compare.openStory', { title: item.title })} variant="secondary" block onPress={() => router.push(`/culture/item/${item.id}` as never)} testID={`fc-open-${item.id}`} />
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

/** One side of a field, in the item's own words - or "Not provided". */
function SideText({ title, label, text, tone, wide, large, testID }: { title: string; label: string; text: string | null; tone: Side; wide: boolean; large: boolean; testID: string }) {
  const { t } = useTranslation();
  const shown = text ?? t('compare.free.notProvided');
  return (
    <View style={[styles.side, tone === 'left' ? styles.sideLeft : styles.sideRight, wide && styles.flex]} accessible accessibilityLabel={t('compare.free.sideA11y', { title, field: label, text: shown })} testID={testID}>
      <Text style={styles.sideTitle}>{title}</Text>
      <Text style={[text ? styles.body : styles.notProvided, large && styles.bodyLarge]}>{shown}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  stack: { gap: spacing.md },
  flex: { flex: 1 },
  section: { ...typography.overline, color: colors.textSecondary },
  body: { ...textStyles.body, color: colors.textPrimary },
  bodyBold: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  bodyLarge: { fontSize: 19, lineHeight: 28 },
  meta: { ...textStyles.small, color: colors.textSecondary },
  notProvided: { ...textStyles.body, color: colors.textSecondary, fontStyle: 'italic' },
  slots: { gap: spacing.sm },
  slotsWide: { flexDirection: 'row' },
  slot: { gap: spacing.xs, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  slotWide: { flex: 1 },
  slotRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  slotTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary, flex: 1 },
  thumb: { width: 56, height: 56, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.surfaceMuted },
  thumbSmall: { width: 40, height: 40, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.surfaceMuted },
  picker: { gap: spacing.xs, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary },
  input: { ...textStyles.body, color: colors.textPrimary, minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: cardRadii.compact, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.background },
  choice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48, padding: spacing.xs, borderRadius: cardRadii.compact },
  choiceOn: { backgroundColor: colors.surfaceAlt },
  cardTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  field: { gap: spacing.xs },
  fieldHeading: { ...typography.overline, color: colors.primary },
  sides: { gap: spacing.xs },
  sidesWide: { flexDirection: 'row', alignItems: 'stretch' },
  side: { gap: 2, padding: spacing.sm, borderRadius: cardRadii.compact, borderLeftWidth: 3 },
  sideLeft: { backgroundColor: colors.surface, borderLeftColor: colors.primary },
  sideRight: { backgroundColor: colors.surfaceAlt, borderLeftColor: colors.accentTerracotta },
  sideTitle: { ...textStyles.small, fontWeight: '700', color: colors.textSecondary },
  card: { gap: spacing.xs, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSubtle },
  link: { gap: 2 },
  quote: { ...textStyles.body, color: colors.textPrimary, fontStyle: 'italic' },
  sources: { gap: spacing.xs },
  kgNote: { gap: 2 },
});
