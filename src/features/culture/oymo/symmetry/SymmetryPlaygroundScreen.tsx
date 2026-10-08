import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useMemo, useReducer, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PanResponder, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button, IconButton, Toggle } from '@/components/ui';
import { announce } from '@/services/a11y/announce';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { handOffToCreator } from '@/services/culture/oymoHandoff';
import type { SymmetryMode } from '@/services/culture/symmetry';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { getMotifShape } from '../motifs';
import { CHALLENGES, compareToTarget, GRID, isSolved, MODES, playgroundReducer, resultOf, startPlayground, toCreatorCopy, cellKey, type Cell, type Challenge, type Piece } from './playgroundModel';

const FREE_MOTIFS = ['muyuz', 'gul', 'kochkorMuyuz', 'tortKulak', 'bulak', 'jalbyrak'];
const INK = colors.primary;

/**
 * /culture/oymo/symmetry - Symmetry Playground (rules in playgroundModel).
 * An editable source grid and its result under the Creator's own symmetry
 * modes, guide lines for the real rule, Undo/Reset, three matching
 * challenges, and "Open in Creator" as an unsaved copy. Everything is
 * local; nothing is saved and no saved creation is touched.
 */
export function SymmetryPlaygroundScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { experience } = useAgeExperience();
  const large = experience === 'child';
  const [state, dispatch] = useReducer(playgroundReducer, undefined, () => startPlayground());
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [motif, setMotif] = useState(FREE_MOTIFS[0]);
  const [selected, setSelected] = useState<string | null>(null);
  const [guides, setGuides] = useState(true);
  const { design } = state;
  const motifs = challenge ? challenge.motifs : FREE_MOTIFS;
  const name = (motifId: string) => t(`culture.oymo.motifs.${motifId}`);
  const modeName = (mode: SymmetryMode) => t(`culture.oymo.symmetry.${mode}`);
  // Narrow phones: grids stacked full width; wider: side by side.
  const sideBySide = width >= 700;
  const gridSize = Math.min(sideBySide ? (Math.min(width, 900) - spacing.lg * 3) / 2 : width - spacing.lg * 2, 320);
  const solved = challenge ? isSolved(challenge, design) : false;
  const selectedPiece = design.pieces.find((piece) => piece.id === selected) ?? null;

  const act = (action: Parameters<typeof playgroundReducer>[1]) => dispatch(action);
  const tapCell = (cell: Cell) => {
    const piece = design.pieces.find((entry) => cellKey(entry.cell) === cellKey(cell));
    if (piece) {
      setSelected((current) => (current === piece.id ? null : piece.id));
      return;
    }
    if (selectedPiece) {
      act({ type: 'move', id: selectedPiece.id, cell });
      setSelected(null);
    } else act({ type: 'place', cell, motifId: motif });
  };

  // Entering, switching or leaving a challenge starts a separate history (and fixes the challenge's rule).
  const startChallenge = (next: Challenge | null) => {
    setChallenge(next);
    setSelected(null);
    setMotif(next ? next.motifs[0] : FREE_MOTIFS[0]);
    act({ type: 'begin', challenge: next });
  };

  const openInCreator = () => {
    const copy = toCreatorCopy(design, INK);
    handOffToCreator(copy.state, { symmetry: copy.symmetry, source: 'symmetry' });
    router.push('/culture/oymo/create' as never);
  };

  const radio = <T extends string>(heading: string, options: readonly T[], value: T, label: (option: T) => string, onSelect: (option: T) => void, id: string, disabled = false) => (
    <View style={styles.group}>
      <Text style={styles.section} accessibilityRole="header">
        {heading}
      </Text>
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={heading}>
        {options.map((option) => {
          const on = option === value;
          return (
            <AnimatedPressable key={option} style={[styles.chip, large && styles.chipLarge, on && styles.chipOn, disabled && !on && styles.chipDisabled]} disabled={disabled} onPress={() => onSelect(option)} accessibilityRole="radio" accessibilityState={{ checked: on, disabled }} aria-checked={on} accessibilityLabel={label(option)} testID={`sym-${id}-${option}`}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{label(option)}</Text>
            </AnimatedPressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
          {t('symmetryPlayground.title')}
        </Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>
        <Text style={[styles.body, large && styles.bodyLarge]}>{t('symmetryPlayground.intro')}</Text>

        {challenge ? (
          <View style={styles.challengeBar} testID="sym-challenge-active">
            <Text style={styles.cardTitle}>{t(`symmetryPlayground.challenge.${challenge.id}.title`)}</Text>
            <Text style={styles.body}>{t(`symmetryPlayground.challenge.${challenge.id}.task`)}</Text>
            {challenge.mode ? <Text style={styles.meta}>{t('symmetryPlayground.ruleFixed', { mode: modeName(challenge.mode) })}</Text> : null}
            <Text style={[styles.status, solved && styles.statusSolved]} accessibilityLiveRegion="polite" testID="sym-status">
              {solved ? t('symmetryPlayground.solved') : t('symmetryPlayground.progress', compareToTarget(challenge, design))}
            </Text>
          </View>
        ) : null}

        {radio(t('symmetryPlayground.modeTitle'), MODES, design.mode, modeName, (mode) => act({ type: 'mode', mode }), 'mode', !!state.lockedMode)}
        {radio(t('symmetryPlayground.motifTitle'), motifs, motif, name, setMotif, 'motif')}

        <View style={styles.toggleRow}>
          <Text style={[styles.body, styles.flex]}>{t('symmetryPlayground.showGuides')}</Text>
          <Toggle value={guides} onValueChange={setGuides} accessibilityLabel={t('symmetryPlayground.showGuides')} />
        </View>

        <View style={[styles.grids, sideBySide && styles.gridsRow]}>
          <View style={styles.group}>
            <Text style={styles.section} accessibilityRole="header">
              {t('symmetryPlayground.sourceTitle')}
            </Text>
            <SourceGrid size={gridSize} pieces={design.pieces} selected={selected} name={name} onTapCell={tapCell} onDrop={(piece, cell) => act({ type: 'move', id: piece.id, cell })} />
            <Text style={styles.meta}>{selectedPiece ? t('symmetryPlayground.movingHint', { name: name(selectedPiece.motifId) }) : t('symmetryPlayground.tapHint')}</Text>
            {selectedPiece ? (
              <View style={styles.row}>
                <Button
                  label={t('symmetryPlayground.remove')}
                  variant="secondary"
                  onPress={() => {
                    act({ type: 'remove', id: selectedPiece.id });
                    setSelected(null);
                  }}
                  testID="sym-remove"
                />
                <Button label={t('symmetryPlayground.cancelMove')} variant="text" onPress={() => setSelected(null)} />
              </View>
            ) : null}
          </View>
          <View style={styles.group}>
            <Text style={styles.section} accessibilityRole="header">
              {t('symmetryPlayground.resultTitle', { mode: modeName(design.mode) })}
            </Text>
            <ResultGrid size={gridSize} marks={resultOf(design)} mode={design.mode} guides={guides} name={name} testID="sym-result" />
          </View>
          {challenge ? (
            <View style={styles.group}>
              <Text style={styles.section} accessibilityRole="header">
                {t('symmetryPlayground.targetTitle')}
              </Text>
              <ResultGrid size={gridSize} marks={challenge.target.map((mark) => ({ ...mark, source: true }))} mode={challenge.mode ?? 'none'} guides={guides && !!challenge.mode} name={name} testID="sym-target" />
            </View>
          ) : null}
        </View>

        <View style={styles.row}>
          <Button label={t('symmetryPlayground.undo')} variant="secondary" disabled={state.history.length === 0} onPress={() => act({ type: 'undo' })} testID="sym-undo" />
          <Button label={t('symmetryPlayground.reset')} variant="secondary" onPress={() => { setSelected(null); act({ type: 'reset' }); }} testID="sym-reset" />
        </View>

        {/* Geometry, kept apart from culture. */}
        <View style={styles.card} testID="sym-rule">
          <Text style={styles.label}>{t('symmetryPlayground.mathLabel')}</Text>
          <Text style={[styles.body, large && styles.bodyLarge]}>{t(`symmetryPlayground.rules.${design.mode}`)}</Text>
          <Text style={styles.meta}>{t('symmetryPlayground.orientationNote')}</Text>
        </View>

        <Button label={t('symmetryPlayground.openInCreator')} onPress={openInCreator} disabled={design.pieces.length === 0} accessibilityHint={t('symmetryPlayground.openInCreatorHint')} testID="sym-open-creator" />
        <Text style={styles.meta}>{t('symmetryPlayground.openInCreatorHint')}</Text>

        <Text style={styles.section} accessibilityRole="header">
          {t('symmetryPlayground.challengesTitle')}
        </Text>
        {CHALLENGES.map((entry) => (
          <View key={entry.id} style={[styles.card, challenge?.id === entry.id && styles.cardOn]}>
            <Text style={styles.cardTitle}>{t(`symmetryPlayground.challenge.${entry.id}.title`)}</Text>
            <Text style={styles.meta}>{t(`symmetryPlayground.challenge.${entry.id}.task`)}</Text>
            <Button label={t('symmetryPlayground.tryIt')} variant="secondary" onPress={() => startChallenge(entry)} testID={`sym-challenge-${entry.id}`} />
          </View>
        ))}
        {challenge ? <Button label={t('symmetryPlayground.freePlay')} variant="text" onPress={() => startChallenge(null)} testID="sym-free-play" /> : null}

        <View style={[styles.card, styles.cultureCard]} testID="sym-culture">
          <Text style={styles.label}>{t('symmetryPlayground.cultureLabel')}</Text>
          <Text style={styles.body}>{t('symmetryPlayground.cultureNote')}</Text>
          <Button label={t('symmetryPlayground.readOymo')} variant="text" onPress={() => router.push('/culture/item/oymo-overview' as never)} />
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * The editable grid. Tap a cell (place / pick up / move there) - the
 * Pressable cells are the accessible, keyboard and screen-reader path.
 * Dragging: the GRID (an ancestor of every cell, so it may take over a
 * touch the cell started) claims the gesture once it moves, and drops the
 * motif on the cell it is released over (by whole cells).
 */
function SourceGrid({ size, pieces, selected, name, onTapCell, onDrop }: { size: number; pieces: Piece[]; selected: string | null; name: (id: string) => string; onTapCell: (cell: Cell) => void; onDrop: (piece: Piece, cell: Cell) => void }) {
  const { t } = useTranslation();
  const cell = size / GRID;
  const pressed = useRef<Cell | null>(null);
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const latest = useRef({ pieces, cell, onDrop });
  latest.current = { pieces, cell, onDrop };
  const pieceAt = (at: Cell | null) => (at ? (latest.current.pieces.find((entry) => cellKey(entry.cell) === cellKey(at)) ?? null) : null);
  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gesture) => Math.abs(gesture.dx) + Math.abs(gesture.dy) > 8 && !!pieceAt(pressed.current),
        onPanResponderGrant: () => {
          const piece = pieceAt(pressed.current);
          if (piece) setDrag({ id: piece.id, dx: 0, dy: 0 });
        },
        onPanResponderMove: (_, gesture) => setDrag((current) => (current ? { ...current, dx: gesture.dx, dy: gesture.dy } : current)),
        onPanResponderRelease: (_, gesture) => {
          const piece = pieceAt(pressed.current);
          const step = latest.current.cell;
          setDrag(null);
          pressed.current = null;
          if (!piece) return;
          const target = { col: piece.cell.col + Math.round(gesture.dx / step), row: piece.cell.row + Math.round(gesture.dy / step) };
          if (target.col !== piece.cell.col || target.row !== piece.cell.row) latest.current.onDrop(piece, target);
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderTerminate: () => {
          setDrag(null);
          pressed.current = null;
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  return (
    <View style={[styles.grid, { width: size, height: size }]} testID="sym-source" {...responder.panHandlers}>
      {Array.from({ length: GRID * GRID }, (_, index) => {
        const at = { col: index % GRID, row: Math.floor(index / GRID) };
        const piece = pieces.find((entry) => cellKey(entry.cell) === cellKey(at));
        const content = piece ? (piece.id === selected ? t('symmetryPlayground.selectedA11y', { name: name(piece.motifId) }) : name(piece.motifId)) : t('symmetryPlayground.empty');
        const Shape = piece ? getMotifShape(piece.motifId) : null;
        const moving = piece && drag?.id === piece.id ? drag : null;
        return (
          <Pressable
            key={index}
            style={[styles.cell, { left: at.col * cell, top: at.row * cell, width: cell, height: cell }, piece?.id === selected && styles.cellSelected, moving && styles.cellLifted]}
            onPressIn={() => (pressed.current = at)}
            onPress={() => onTapCell(at)}
            accessibilityRole="button"
            accessibilityLabel={t('symmetryPlayground.cellA11y', { row: at.row + 1, col: at.col + 1, content })}
            accessibilityState={{ selected: piece?.id === selected }}
            testID={`sym-cell-${at.col}-${at.row}`}
          >
            {piece && Shape ? (
              <View style={[styles.piece, moving ? { transform: [{ translateX: moving.dx }, { translateY: moving.dy }] } : null]} testID={`sym-piece-${piece.cell.col}-${piece.cell.row}`}>
                <Shape size={cell * 0.62} color={INK} />
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** A read-only result (or target) with the rule's guide lines. Copies are drawn lighter than the source. */
function ResultGrid({ size, marks, mode, guides, name, testID }: { size: number; marks: ReturnType<typeof resultOf>; mode: SymmetryMode; guides: boolean; name: (id: string) => string; testID: string }) {
  const { t } = useTranslation();
  const cell = size / GRID;
  const label = marks.length === 0 ? t('symmetryPlayground.empty') : marks.map((mark) => t('symmetryPlayground.cellA11y', { row: mark.cell.row + 1, col: mark.cell.col + 1, content: mark.source ? name(mark.motifId) : t('symmetryPlayground.copy', { name: name(mark.motifId) }) })).join('; ');
  return (
    <View style={[styles.grid, { width: size, height: size }]} accessible accessibilityRole="image" accessibilityLabel={label} testID={testID}>
      {Array.from({ length: GRID * GRID }, (_, index) => (
        <View key={index} style={[styles.cell, { left: (index % GRID) * cell, top: Math.floor(index / GRID) * cell, width: cell, height: cell }]} />
      ))}
      {guides && mode !== 'none' ? <View style={[styles.guide, styles.guideVertical, { left: size / 2 - 1 }]} testID={`${testID}-guide-vertical`} /> : null}
      {guides && mode === 'fourWay' ? <View style={[styles.guide, styles.guideHorizontal, { top: size / 2 - 1 }]} testID={`${testID}-guide-horizontal`} /> : null}
      {marks.map((mark) => {
        const Shape = getMotifShape(mark.motifId);
        return (
          <View key={`${cellKey(mark.cell)}-${mark.motifId}`} style={[styles.mark, { left: mark.cell.col * cell, top: mark.cell.row * cell, width: cell, height: cell, opacity: mark.source ? 1 : 0.55 }]} testID={`${testID}-mark-${mark.cell.col}-${mark.cell.row}`}>
            <Shape size={cell * 0.62} color={INK} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  group: { gap: spacing.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  flex: { flex: 1 },
  section: { ...typography.overline, color: colors.textSecondary },
  label: { ...textStyles.overline, color: colors.primary },
  body: { ...textStyles.body, color: colors.textPrimary },
  bodyLarge: { fontSize: 19, lineHeight: 28 },
  meta: { ...textStyles.small, color: colors.textSecondary },
  status: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textSecondary },
  statusSolved: { color: colors.primary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { minHeight: 44, paddingHorizontal: spacing.md, justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.surface },
  chipLarge: { minHeight: 52 },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipDisabled: { opacity: 0.5 },
  chipText: { ...textStyles.bodyMedium, color: colors.textPrimary },
  chipTextOn: { color: colors.textOnPrimary, fontWeight: '700' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  grids: { gap: spacing.md },
  gridsRow: { flexDirection: 'row', flexWrap: 'wrap' },
  grid: { position: 'relative', borderRadius: 8, overflow: 'hidden', backgroundColor: '#EADCC0', borderWidth: 1, borderColor: colors.borderSubtle },
  cell: { position: 'absolute', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(43,32,25,0.18)', alignItems: 'center', justifyContent: 'center' },
  cellSelected: { borderWidth: 3, borderColor: colors.primary, borderStyle: 'dashed' },
  cellLifted: { zIndex: 2 },
  piece: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  mark: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  guide: { position: 'absolute', backgroundColor: colors.accentTerracotta },
  guideVertical: { top: 0, bottom: 0, width: 2 },
  guideHorizontal: { left: 0, right: 0, height: 2 },
  card: { gap: spacing.xs, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSubtle },
  cardOn: { borderColor: colors.primary, borderWidth: 2 },
  cultureCard: { borderStyle: 'dashed' },
  cardTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  challengeBar: { gap: 4, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.primary },
});
