import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button, IconButton } from '@/components/ui';
import { useRecordsOwner } from '@/features/games/records/useGameRecords';
import { announce } from '@/services/a11y/announce';
import { handOffToCreator } from '@/services/culture/oymoHandoff';
import { MAX_OYMO_LAYERS } from '@/services/culture/oymoEditor';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { ColorSwatches } from '../components/ColorSwatches';
import { MotifGrid } from '../components/MotifGrid';
import { OymoArtwork } from '../components/OymoArtwork';
import { getMotifShape, OYMO_MOTIFS } from '../motifs';
import { buildBorder, clampRepeat, DEFAULT_REPEAT, describeTile, EMPTY_TILE, keepWorkshop, LAYOUTS, maxCount, pieceAt, placePiece, recolorPiece, removePiece, resizeTile, resumeWorkshop, rotatePiece, SPACING_MAX, SPACING_STEP, spacingMin, TILE_CELLS, TILE_SIZES, tileCount, type Layout, type Repeat, type Tile } from './borderModel';

const BACKGROUND = '#EADCC0';

/**
 * /culture/oymo/border - Border Workshop (borderModel.ts). Arrange motifs
 * in one tile, repeat it as a strip or a frame, adjust count and spacing
 * within safe limits, preview, and open the result as an unsaved Creator
 * copy. Your own creation - no traditional name or meaning is given. No
 * animation; offline; nothing is saved here.
 */
export function BorderWorkshopScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const owner = useRecordsOwner();
  const resumed = useMemo(() => resumeWorkshop(owner), [owner]);
  const [tile, setTile] = useState<Tile>(() => resumed?.tile ?? EMPTY_TILE);
  const [repeat, setRepeat] = useState<Repeat>(() => resumed?.repeat ?? DEFAULT_REPEAT);
  const [motif, setMotif] = useState<string>(OYMO_MOTIFS[0].id);
  const [color, setColor] = useState<string>(colors.primary);
  const [selected, setSelected] = useState<string | null>(null);
  // Another account: not the previous one's tile.
  useEffect(() => {
    const next = resumeWorkshop(owner);
    setTile(next?.tile ?? EMPTY_TILE);
    setRepeat(next?.repeat ?? DEFAULT_REPEAT);
    setSelected(null);
  }, [owner]);
  useEffect(() => keepWorkshop(owner, tile, repeat), [owner, tile, repeat]);

  const safe = clampRepeat(repeat, tile);
  const border = useMemo(() => buildBorder(tile, safe, BACKGROUND), [tile, safe.layout, safe.count, safe.spacing]); // eslint-disable-line react-hooks/exhaustive-deps
  const max = maxCount(safe.layout, tile, safe.spacing);
  const motifName = (id: string) => t(`culture.oymo.motifs.${id}`);
  const colorName = (hex: string) => t(`borderWorkshop.colors.${COLOR_KEYS[hex] ?? 'other'}`);
  const tileSide = Math.min(width - spacing.lg * 2, 240);
  const cell = tileSide / TILE_CELLS;
  const previewSize = Math.min(width - spacing.lg * 2, 320);
  const selectedPiece = tile.pieces.find((piece) => piece.id === selected) ?? null;
  const setSafe = (next: Repeat, nextTile = tile) => setRepeat(clampRepeat(next, nextTile));

  const tapCell = (col: number, row: number) => {
    const piece = pieceAt(tile, col, row);
    if (piece) return setSelected(selected === piece.id ? null : piece.id);
    const next = placePiece(tile, col, row, motif, color);
    setTile(next);
    setSafe(repeat, next); // more pieces can lower the safe maximum
  };
  const open = () => {
    handOffToCreator(border.state, { symmetry: 'none', source: 'border' });
    announce(t('borderWorkshop.opened'));
    router.push('/culture/oymo/create' as never);
  };
  const summary = [
    ...describeTile(tile).map((piece) => t('borderWorkshop.summary.piece', { row: piece.row + 1, col: piece.col + 1, motif: motifName(piece.motifId), color: colorName(piece.color), rotation: piece.rotation })),
    t('borderWorkshop.summary.settings', { layout: t(`borderWorkshop.layouts.${safe.layout}`), count: safe.count, spacing: safe.spacing, size: tile.size }),
    t('borderWorkshop.summary.result', { count: border.tiles, tiles: border.tiles, layers: border.state.layers.length, max: MAX_OYMO_LAYERS }),
  ];

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
          {t('borderWorkshop.title')}
        </Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} testID="border-workshop">
        <Text style={styles.body}>{t('borderWorkshop.intro')}</Text>
        <Text style={styles.note}>{t('borderWorkshop.ownCreation')}</Text>

        <Text style={styles.section} accessibilityRole="header">
          {t('borderWorkshop.tileTitle')}
        </Text>
        <MotifGrid selectedMotifId={motif as never} onSelectMotif={(id) => setMotif(id)} color={color} />
        <ColorSwatches selectedColor={color} onSelectColor={(next) => (selectedPiece ? setTile(recolorPiece(tile, selectedPiece.id, next)) : setColor(next))} />
        <View style={[styles.tile, { width: tileSide, height: tileSide }]} testID="border-tile">
          {Array.from({ length: TILE_CELLS * TILE_CELLS }, (_, index) => {
            const col = index % TILE_CELLS;
            const row = Math.floor(index / TILE_CELLS);
            const piece = pieceAt(tile, col, row);
            const Shape = piece ? getMotifShape(piece.motifId) : null;
            const content = piece ? t('borderWorkshop.cellContent', { motif: motifName(piece.motifId), color: colorName(piece.color), rotation: piece.rotation }) : t('borderWorkshop.empty');
            return (
              <Pressable
                key={index}
                style={[styles.cell, { left: col * cell, top: row * cell, width: cell, height: cell }, piece?.id === selected && styles.cellSelected]}
                onPress={() => tapCell(col, row)}
                accessibilityRole="button"
                accessibilityState={{ selected: piece?.id === selected }}
                accessibilityLabel={t('borderWorkshop.cellA11y', { row: row + 1, col: col + 1, content })}
                testID={`border-cell-${col}-${row}`}
              >
                {piece && Shape ? (
                  <View style={{ transform: [{ rotate: `${piece.rotation}deg` }] }}>
                    <Shape size={cell * 0.7} color={piece.color} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.meta}>{t('borderWorkshop.tileHint')}</Text>
        {selectedPiece ? (
          <View style={styles.row}>
            <Button label={t('borderWorkshop.rotate')} variant="secondary" size="sm" onPress={() => setTile(rotatePiece(tile, selectedPiece.id))} testID="border-rotate" />
            <Button label={t('borderWorkshop.remove')} variant="secondary" size="sm" onPress={() => { setTile(removePiece(tile, selectedPiece.id)); setSelected(null); }} testID="border-remove" />
            <Button label={t('borderWorkshop.done')} variant="text" size="sm" onPress={() => setSelected(null)} />
          </View>
        ) : null}
        <ChipRow heading={t('borderWorkshop.tileSize')} options={TILE_SIZES.map((size) => ({ id: String(size), label: t('borderWorkshop.sizeOption', { size }), on: tile.size === size }))} onSelect={(id) => { const next = resizeTile(tile, Number(id) as Tile['size']); setTile(next); setSafe(repeat, next); }} testPrefix="border-size" />

        <Text style={styles.section} accessibilityRole="header">
          {t('borderWorkshop.repeatTitle')}
        </Text>
        <ChipRow heading={t('borderWorkshop.layoutTitle')} options={LAYOUTS.map((layout) => ({ id: layout, label: t(`borderWorkshop.layouts.${layout}`), on: safe.layout === layout }))} onSelect={(id) => setSafe({ ...safe, layout: id as Layout })} testPrefix="border-layout" />
        <Stepper label={t('borderWorkshop.count', { count: safe.count, max })} value={safe.count} canDown={safe.count > 1} canUp={safe.count < max} onChange={(delta) => setSafe({ ...safe, count: safe.count + delta })} testPrefix="border-count" />
        {safe.count >= max ? <Text style={styles.meta} testID="border-max-note">{t('borderWorkshop.maxNote', { max, layers: MAX_OYMO_LAYERS })}</Text> : null}
        <Stepper label={t('borderWorkshop.spacing', { spacing: safe.spacing })} value={safe.spacing} canDown={safe.spacing > spacingMin(tile.size)} canUp={safe.spacing < SPACING_MAX} onChange={(delta) => setSafe({ ...safe, spacing: safe.spacing + delta * SPACING_STEP })} testPrefix="border-spacing" />
        {border.overlap > 0 ? (
          <Text style={styles.overlap} accessibilityLiveRegion="polite" testID="border-overlap">
            {t('borderWorkshop.overlap', { amount: border.overlap })}
          </Text>
        ) : null}

        <Text style={styles.section} accessibilityRole="header">
          {t('borderWorkshop.previewTitle')}
        </Text>
        <View style={[styles.preview, { width: previewSize, height: previewSize }]} accessible accessibilityRole="image" accessibilityLabel={summary.join('. ')} testID="border-preview">
          <OymoArtwork layers={border.state.layers} backgroundColor={border.state.backgroundColor} symmetryMode="none" size={previewSize} />
        </View>
        <View style={styles.card} testID="border-summary">
          <Text style={styles.label}>{t('borderWorkshop.summaryTitle')}</Text>
          {tile.pieces.length === 0 ? <Text style={styles.meta}>{t('borderWorkshop.emptyTile')}</Text> : null}
          {summary.map((line) => (
            <Text key={line} style={styles.meta}>
              {line}
            </Text>
          ))}
        </View>
        <Button label={t('borderWorkshop.open')} disabled={border.state.layers.length === 0} accessibilityHint={t('borderWorkshop.openHint')} onPress={open} testID="border-open" />
        <Text style={styles.meta}>{t('borderWorkshop.openHint')}</Text>
      </ScrollView>
    </View>
  );
}

const COLOR_KEYS: Record<string, string> = { [colors.primary]: 'green', [colors.tiles.food]: 'orange', [colors.accentBrown]: 'brown', [colors.accentGold]: 'gold', [colors.textMuted]: 'grey', [colors.accentBrownDark]: 'darkBrown' };

function ChipRow({ heading, options, onSelect, testPrefix }: { heading: string; options: { id: string; label: string; on: boolean }[]; onSelect: (id: string) => void; testPrefix: string }) {
  return (
    <View style={styles.stack}>
      <Text style={styles.meta}>{heading}</Text>
      <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={heading}>
        {options.map((option) => (
          <AnimatedPressable key={option.id} style={[styles.chip, option.on && styles.chipOn]} onPress={() => onSelect(option.id)} accessibilityRole="radio" accessibilityState={{ checked: option.on }} aria-checked={option.on} testID={`${testPrefix}-${option.id}`}>
            <Text style={[styles.chipText, option.on && styles.chipTextOn]}>{option.label}</Text>
          </AnimatedPressable>
        ))}
      </View>
    </View>
  );
}

function Stepper({ label, canDown, canUp, onChange, testPrefix }: { label: string; value: number; canDown: boolean; canUp: boolean; onChange: (delta: -1 | 1) => void; testPrefix: string }) {
  const { t } = useTranslation();
  return (
    // Plain buttons with a live value (a slider role on the row would nest buttons inside a slider on web).
    <View style={styles.stepper}>
      <Button label={`− ${t('borderWorkshop.less')}`} variant="secondary" size="sm" disabled={!canDown} accessibilityHint={label} onPress={() => onChange(-1)} testID={`${testPrefix}-down`} />
      <Text style={[styles.body, styles.flex]} accessibilityLiveRegion="polite" testID={`${testPrefix}-value`}>
        {label}
      </Text>
      <Button label={`+ ${t('borderWorkshop.more')}`} variant="secondary" size="sm" disabled={!canUp} accessibilityHint={label} onPress={() => onChange(1)} testID={`${testPrefix}-up`} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  stack: { gap: spacing.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center' },
  flex: { flex: 1 },
  section: { ...typography.overline, color: colors.textSecondary, marginTop: spacing.sm },
  label: { ...textStyles.overline, color: colors.primary },
  body: { ...textStyles.body, color: colors.textPrimary },
  meta: { ...textStyles.small, color: colors.textSecondary },
  overlap: { ...textStyles.small, fontWeight: '700', color: colors.accentTerracottaText },
  note: { ...textStyles.small, color: colors.textPrimary, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceMuted },
  card: { gap: 2, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  tile: { alignSelf: 'center', position: 'relative', backgroundColor: BACKGROUND, borderRadius: 8, borderWidth: 1, borderColor: colors.borderSubtle, overflow: 'hidden' },
  cell: { position: 'absolute', alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(43,32,25,0.18)' },
  cellSelected: { borderWidth: 3, borderColor: colors.primary, borderStyle: 'dashed' },
  preview: { alignSelf: 'center', borderRadius: cardRadii.compact, overflow: 'hidden', borderWidth: 1, borderColor: colors.borderSubtle },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: 22, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...textStyles.bodyMedium, color: colors.textPrimary },
  chipTextOn: { color: colors.textOnPrimary, fontWeight: '700' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
