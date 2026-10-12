import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Rect } from 'react-native-svg';

import { AnimatedPressable, Button, IconButton } from '@/components/ui';
import { sectionLabelKey } from '@/features/culture/itemSections';
import { announce } from '@/services/a11y/announce';
import { useAllCultureItems } from '@/services/content/cultureItemsService';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { keepSelection, nextZoom, SCHEMATIC, SCHEMATIC_POLES, selectionFor, sourceRoute, toScreen, ZOOMS, type ExplorerIllustration, type Zoom } from './explorerModel';

const MARKER = 28;

/**
 * Object Explorer (explorerModel.ts): tap a numbered point, read the part's
 * reviewed name and description with its source, open the source article
 * and come back to the same selection. The numbered list below carries the
 * same information for screen readers. Labels are shown BELOW the image, so
 * they never cover it; markers are small numbered dots.
 */
export function ObjectExplorerScreen({ illustration, onPressBack }: { illustration: ExplorerIllustration; onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const items = useAllCultureItems();
  const [selected, setSelected] = useState<string | null>(() => selectionFor(illustration));
  const [zoom, setZoom] = useState<Zoom>(1);
  useEffect(() => setSelected(selectionFor(illustration)), [illustration]);
  const width = Math.min(windowWidth - spacing.lg * 2, 520);
  const height = width / illustration.aspect;

  const articles = useMemo(() => new Map((items.data ?? []).map((item) => [item.id, item])), [items.data]);
  const select = (id: string) => {
    setSelected(id);
    keepSelection(illustration.id, id);
    const index = illustration.points.findIndex((point) => point.id === id);
    announce(`${index + 1}. ${t(illustration.points[index].nameKey)}`);
  };
  const point = illustration.points.find((entry) => entry.id === selected) ?? null;
  const sourceText = (articleId: string, sectionKey: string) => {
    const article = articles.get(articleId);
    const sectionKeyLabel = sectionLabelKey(sectionKey);
    return t('objectExplorer.source', { article: article?.title ?? articleId, section: sectionKeyLabel ? t(sectionKeyLabel) : sectionKey });
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
          {t(illustration.titleKey)}
        </Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} testID="explorer">
        {illustration.fixture ? (
          <Text style={styles.banner} testID="explorer-fixture-banner">
            {t('objectExplorer.fixtureBanner')}
          </Text>
        ) : null}
        <Text style={styles.body}>{t('objectExplorer.howTo')}</Text>

        <View style={styles.wrap}>
          <Button label={t('objectExplorer.zoomIn')} variant="secondary" size="sm" disabled={zoom === ZOOMS[ZOOMS.length - 1]} onPress={() => setZoom(nextZoom(zoom))} testID="explorer-zoom-in" />
          <Button label={t('objectExplorer.reset')} variant="secondary" size="sm" disabled={zoom === 1} onPress={() => setZoom(1)} testID="explorer-reset" />
          <Text style={styles.meta} testID="explorer-zoom">
            {t('objectExplorer.zoomLevel', { zoom: `${zoom}×` })}
          </Text>
        </View>

        <ScrollView horizontal style={{ width, alignSelf: 'center' }} contentContainerStyle={{ width: width * zoom }} testID="explorer-viewport">
          <View style={{ width: width * zoom, height: height * zoom }} testID="explorer-image">
            {illustration.artwork.kind === 'image' ? (
              <Image source={illustration.artwork.asset} style={{ width: width * zoom, height: height * zoom }} resizeMode="stretch" accessibilityIgnoresInvertColors />
            ) : (
              <SchematicBozUy width={width * zoom} height={height * zoom} />
            )}
            {illustration.points.map((entry, index) => {
              const { left, top } = toScreen(entry, width, zoom, illustration.aspect);
              const isSelected = entry.id === selected;
              return (
                <AnimatedPressable
                  key={entry.id}
                  style={[styles.marker, isSelected && styles.markerOn, { left: left - MARKER / 2, top: top - MARKER / 2 }]}
                  onPress={() => select(entry.id)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${index + 1}. ${t(entry.nameKey)}`}
                  testID={`explorer-point-${entry.id}`}
                >
                  <Text style={[styles.markerText, isSelected && styles.markerTextOn]}>{index + 1}</Text>
                </AnimatedPressable>
              );
            })}
          </View>
        </ScrollView>

        {point ? (
          <View style={styles.panel} testID="explorer-selected" accessibilityLiveRegion="polite">
            <Text style={styles.heading} accessibilityRole="header">
              {illustration.points.indexOf(point) + 1}. {t(point.nameKey)}
            </Text>
            <Text style={styles.body}>{t(point.descriptionKey)}</Text>
            <Text style={styles.meta} testID="explorer-source">
              {sourceText(point.source.articleId, point.source.sectionKey)}
            </Text>
            {articles.has(point.source.articleId) ? (
              <Button label={t('objectExplorer.openSource')} variant="secondary" onPress={() => router.push(sourceRoute(point.source) as never)} testID="explorer-open-source" />
            ) : (
              <Text style={styles.warn} testID="explorer-source-unavailable">
                {items.data ? t('objectExplorer.sourceRemoved') : t('objectExplorer.sourceOffline')}
              </Text>
            )}
          </View>
        ) : (
          <Text style={styles.meta}>{t('objectExplorer.nothingSelected')}</Text>
        )}

        <Text style={styles.section} accessibilityRole="header">
          {t('objectExplorer.listTitle')}
        </Text>
        {illustration.points.map((entry, index) => (
          <AnimatedPressable key={entry.id} style={[styles.row, entry.id === selected && styles.rowOn]} onPress={() => select(entry.id)} accessibilityRole="button" accessibilityState={{ selected: entry.id === selected }} accessibilityLabel={`${index + 1}. ${t(entry.nameKey)}. ${t(entry.descriptionKey)} ${sourceText(entry.source.articleId, entry.source.sectionKey)}`} testID={`explorer-row-${entry.id}`}>
            <Text style={styles.cardTitle}>
              {index + 1}. {t(entry.nameKey)}
            </Text>
            <Text style={styles.body}>{t(entry.descriptionKey)}</Text>
            <Text style={styles.meta}>{sourceText(entry.source.articleId, entry.source.sectionKey)}</Text>
          </AnimatedPressable>
        ))}
        {illustration.credit ? <Text style={styles.meta}>{t('objectExplorer.credit', { credit: illustration.credit, license: illustration.license ?? '' })}</Text> : null}
      </ScrollView>
    </View>
  );
}

/** The internal fixture's schematic - drawn from the SAME constants its points use. */
export function SchematicBozUy({ width, height }: { width: number; height: number }) {
  const { tunduk, kerege, door } = SCHEMATIC;
  const stroke = colors.accentBrown;
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${SCHEMATIC.width} ${SCHEMATIC.height}`} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Rect width={SCHEMATIC.width} height={SCHEMATIC.height} fill={colors.surfaceElevated} />
      {SCHEMATIC_POLES.map((pole, index) => (
        <Line key={index} {...pole} stroke={stroke} strokeWidth={0.8} />
      ))}
      <Circle cx={tunduk.cx} cy={tunduk.cy} r={tunduk.r} stroke={stroke} strokeWidth={1.2} fill="none" />
      <Line x1={tunduk.cx - tunduk.r} y1={tunduk.cy} x2={tunduk.cx + tunduk.r} y2={tunduk.cy} stroke={stroke} strokeWidth={0.8} />
      <Line x1={tunduk.cx} y1={tunduk.cy - tunduk.r} x2={tunduk.cx} y2={tunduk.cy + tunduk.r} stroke={stroke} strokeWidth={0.8} />
      <Rect x={kerege.x} y={kerege.y} width={kerege.w} height={kerege.h} stroke={stroke} strokeWidth={1} fill="none" />
      {Array.from({ length: 19 }, (_, i) => kerege.x + i * 4).map((x) => (
        <Line key={`k${x}`} x1={x} y1={kerege.y} x2={Math.min(x + 4, kerege.x + kerege.w)} y2={kerege.y + kerege.h} stroke={stroke} strokeWidth={0.4} />
      ))}
      <Rect x={door.x} y={door.y} width={door.w} height={door.h} stroke={stroke} strokeWidth={1.2} fill={colors.surfaceMuted} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center' },
  section: { ...typography.overline, color: colors.textSecondary, marginTop: spacing.sm },
  heading: { ...typography.h2, color: colors.textPrimary },
  body: { ...textStyles.body, color: colors.textPrimary },
  meta: { ...textStyles.small, color: colors.textSecondary },
  warn: { ...textStyles.small, fontWeight: '700', color: colors.accentTerracottaText },
  banner: { ...textStyles.small, fontWeight: '700', color: colors.textPrimary, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceMuted, borderLeftWidth: 4, borderLeftColor: colors.accentTerracottaText },
  marker: { position: 'absolute', width: MARKER, height: MARKER, borderRadius: MARKER / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.primary },
  markerOn: { backgroundColor: colors.primary },
  markerText: { ...textStyles.small, fontWeight: '700', color: colors.primary },
  markerTextOn: { color: colors.textOnPrimary },
  panel: { gap: spacing.xs, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 2, borderColor: colors.primary },
  row: { gap: 2, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  rowOn: { borderColor: colors.primary, borderWidth: 2 },
  cardTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
});
