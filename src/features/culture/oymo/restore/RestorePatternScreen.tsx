import { router } from 'expo-router';
import { Check, ChevronLeft, ChevronRight, Lightbulb, Lock, RotateCcw, RotateCw, Undo2 } from 'lucide-react-native';
import { useEffect, useReducer, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button, IconButton } from '@/components/ui';
import { announce } from '@/services/a11y/announce';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { useTrackScreenView } from '@/services/analytics/useTrackScreenView';
import { handOffToCreator } from '@/services/culture/oymoHandoff';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { getMotifShape, OYMO_MOTIFS } from '../motifs';
import { BOARD_SLOTS, correctCount, isSolved, puzzleReducer, startPuzzle, toCreatorState, type Piece, type PuzzleAction, type PuzzleState } from './restoreModel';
import { DESCRIBED_MOTIFS, MOTIF_ARTICLES, PIECE_COLORS, RESTORE_PUZZLES, type Placement } from './restorePuzzles';

const motifName = (t: (key: string) => string, motifId: string) => t(OYMO_MOTIFS.find((motif) => motif.id === motifId)?.nameKey ?? motifId);

/**
 * /culture/oymo/restore - "Restore the Pattern": copy a target pattern with
 * the Oymo Creator's motifs. Tap a piece, tap where it goes; every control
 * is a labelled button (no gesture or colour is the only way). Offline.
 * Saved Oymo creations are never read or changed here; a solved pattern
 * opens in the Creator as a new, unsaved copy.
 */
export function RestorePatternScreen({ onPressBack }: { onPressBack: () => void }) {
  useTrackScreenView('oymo_restore');
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const large = experience === 'child';
  const [index, setIndex] = useState(0);
  const [state, dispatch] = useReducer((current: PuzzleState, action: PuzzleAction | { type: 'load'; index: number }) => (action.type === 'load' ? startPuzzle(RESTORE_PUZZLES[action.index]) : puzzleReducer(current, action)), RESTORE_PUZZLES[0], startPuzzle);
  const solved = isSolved(state);
  const selected = [...state.board.tray, ...state.board.slots.filter((piece): piece is Piece => !!piece)].find((piece) => piece.id === state.board.selectedId) ?? null;
  const pieceText = (piece: Pick<Piece, 'motifId' | 'color' | 'rotation'>) => t('restorePattern.pieceA11y', { motif: motifName(t, piece.motifId), color: t(`restorePattern.colors.${piece.color}`), rotation: piece.rotation });
  const motifsHere = [...new Set([...state.puzzle.fixed, ...state.puzzle.target].map((placement) => placement.motifId))];

  useEffect(() => {
    if (solved) announce(t('restorePattern.solved'));
  }, [solved]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = (next: number) => {
    setIndex(next);
    dispatch({ type: 'load', index: next });
  };

  const openInCreator = () => {
    handOffToCreator(toCreatorState(state));
    router.push('/culture/oymo/create' as never);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
          {t('restorePattern.title')}
        </Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        <Text style={[styles.body, large && styles.bodyLarge]}>{t('restorePattern.intro')}</Text>
        <View style={styles.picker} accessibilityRole="radiogroup" accessibilityLabel={t('restorePattern.choosePuzzle')}>
          {RESTORE_PUZZLES.map((puzzle, number) => (
            <AnimatedPressable key={puzzle.id} style={[styles.pickerItem, number === index && styles.pickerItemOn]} onPress={() => load(number)} accessibilityRole="radio" accessibilityState={{ checked: number === index }} aria-checked={number === index} accessibilityLabel={t('restorePattern.puzzleName', { number: number + 1 })} testID={`restore-pick-${number + 1}`}>
              <Text style={styles.pickerText}>{number + 1}</Text>
            </AnimatedPressable>
          ))}
        </View>
        <Text style={styles.meta} testID="restore-puzzle-of">
          {t('restorePattern.puzzleOf', { current: index + 1, total: RESTORE_PUZZLES.length })}
        </Text>

        <View style={styles.boards}>
          <View style={styles.boardColumn}>
            <Text style={styles.label}>{t('restorePattern.target')}</Text>
            <Grid size="small" testID="restore-target" cells={Array.from({ length: BOARD_SLOTS }, (_, slot) => [...state.puzzle.fixed, ...state.puzzle.target].find((placement) => placement.slot === slot) ?? null)} label={(placement, slot) => t('restorePattern.slotA11y', { row: Math.floor(slot / 3) + 1, column: (slot % 3) + 1, content: placement ? pieceText(placement) : t('restorePattern.empty') })} />
          </View>
        </View>

        <Text style={styles.label}>{t('restorePattern.board')}</Text>
        <Grid
          size="large"
          testID="restore-board"
          cells={state.board.slots}
          selectedId={state.board.selectedId}
          fixedSlots={new Set(state.puzzle.fixed.map((placement) => placement.slot))}
          onPressSlot={solved ? undefined : (slot) => dispatch({ type: 'slot', slot })}
          label={(piece, slot) => {
            const content = t('restorePattern.slotA11y', { row: Math.floor(slot / 3) + 1, column: (slot % 3) + 1, content: piece ? pieceText(piece) : t('restorePattern.empty') });
            return state.puzzle.fixed.some((placement) => placement.slot === slot) ? t('restorePattern.fixedA11y', { content }) : content;
          }}
        />
        <Text style={styles.meta} testID="restore-progress" accessibilityLiveRegion="polite">
          {t('restorePattern.progress', { correct: correctCount(state), total: state.puzzle.target.length })}
          {state.hintsUsed > 0 ? ` · ${t('restorePattern.hintsUsed', { count: state.hintsUsed })}` : ''}
        </Text>

        {solved ? (
          <View style={styles.card} testID="restore-solved">
            <Text style={styles.cardTitle}>{t('restorePattern.solved')}</Text>
            <Text style={styles.body}>{t('restorePattern.solvedBody')}</Text>
            <Button label={t('restorePattern.openInCreator')} onPress={openInCreator} testID="restore-open-creator" />
            {index < RESTORE_PUZZLES.length - 1 ? <Button label={t('restorePattern.nextPuzzle')} variant="secondary" onPress={() => load(index + 1)} testID="restore-next" /> : null}
          </View>
        ) : (
          <>
            {selected ? (
              <Text style={styles.meta} testID="restore-selected">
                {t('restorePattern.selected', { piece: pieceText(selected) })}
              </Text>
            ) : null}
            <View style={styles.controls}>
              <Button label={t('restorePattern.turn')} icon={<RotateCw size={16} color={colors.primary} strokeWidth={2.25} />} variant="secondary" size="sm" onPress={() => dispatch({ type: 'turn' })} disabled={!selected} testID="restore-turn" />
              <Button label={t('restorePattern.toTray')} variant="secondary" size="sm" onPress={() => dispatch({ type: 'toTray' })} disabled={!selected || state.board.tray.some((piece) => piece.id === selected.id)} testID="restore-to-tray" />
              <Button label={t('restorePattern.undo')} icon={<Undo2 size={16} color={colors.primary} strokeWidth={2.25} />} variant="secondary" size="sm" onPress={() => dispatch({ type: 'undo' })} disabled={!state.previous} testID="restore-undo" />
              <Button label={t('restorePattern.reset')} icon={<RotateCcw size={16} color={colors.primary} strokeWidth={2.25} />} variant="secondary" size="sm" onPress={() => dispatch({ type: 'reset' })} testID="restore-reset" />
              <Button label={t('restorePattern.hint')} icon={<Lightbulb size={16} color={colors.primary} strokeWidth={2.25} />} variant="text" size="sm" onPress={() => dispatch({ type: 'hint' })} testID="restore-hint" />
            </View>
            <Text style={styles.label}>{t('restorePattern.pieces')}</Text>
            {state.board.tray.length === 0 ? <Text style={styles.meta}>{t('restorePattern.trayEmpty')}</Text> : null}
            <View style={styles.tray} testID="restore-tray">
              {state.board.tray.map((piece) => {
                const isSelected = piece.id === state.board.selectedId;
                return (
                  <AnimatedPressable key={piece.id} style={[styles.trayPiece, isSelected && styles.selected]} onPress={() => dispatch({ type: 'select', pieceId: piece.id })} accessibilityRole="button" accessibilityState={{ selected: isSelected }} accessibilityLabel={pieceText(piece)} testID={`restore-piece-${piece.id}`}>
                    <MotifView motifId={piece.motifId} color={PIECE_COLORS[piece.color]} rotation={piece.rotation} size={34} />
                    <Text style={styles.pieceCaption}>{t(`restorePattern.colors.${piece.color}`)}</Text>
                    {isSelected ? <Check size={12} color={colors.primary} strokeWidth={3} /> : null}
                  </AnimatedPressable>
                );
              })}
            </View>
          </>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('restorePattern.aboutMotifs')}</Text>
          {motifsHere.map((motifId) => (
            <View key={motifId} style={styles.motifRow}>
              <MotifView motifId={motifId} color={colors.primary} rotation={0} size={24} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.body}>{motifName(t, motifId)}</Text>
                {/* Only existing, reviewed descriptions - no meaning is written for the rest. */}
                {DESCRIBED_MOTIFS.includes(motifId) ? <Text style={styles.meta}>{t(`restorePattern.descriptions.${motifId}`)}</Text> : null}
                {MOTIF_ARTICLES[motifId] ? (
                  <AnimatedPressable style={styles.link} onPress={() => router.push(`/culture/item/${MOTIF_ARTICLES[motifId]}` as never)} accessibilityRole="link" accessibilityLabel={t('restorePattern.readAbout', { motif: motifName(t, motifId) })}>
                    <Text style={styles.linkText}>{t('restorePattern.readAbout', { motif: motifName(t, motifId) })}</Text>
                    <ChevronRight size={14} color={colors.primary} strokeWidth={2} />
                  </AnimatedPressable>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function MotifView({ motifId, color, rotation, size }: { motifId: string; color: string; rotation: number; size: number }) {
  const Shape = getMotifShape(motifId);
  return (
    <View style={{ transform: [{ rotate: `${rotation}deg` }] }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Shape size={size} color={color} />
    </View>
  );
}

type Cell = Pick<Piece, 'motifId' | 'color' | 'rotation'> & { id?: string };

function Grid<T extends Cell | Placement>({ cells, size, label, onPressSlot, selectedId = null, fixedSlots, testID }: { cells: (T | null)[]; size: 'small' | 'large'; label: (cell: T | null, slot: number) => string; onPressSlot?: (slot: number) => void; selectedId?: string | null; fixedSlots?: Set<number>; testID: string }) {
  const cellSize = size === 'large' ? 92 : 48;
  return (
    <View style={[styles.grid, { width: cellSize * 3 + 4 }]} testID={testID}>
      {cells.map((cell, slot) => {
        const fixed = fixedSlots?.has(slot);
        const isSelected = !!cell && 'id' in cell && cell.id === selectedId;
        const content = cell ? <MotifView motifId={cell.motifId} color={PIECE_COLORS[cell.color as keyof typeof PIECE_COLORS]} rotation={cell.rotation} size={cellSize * 0.62} /> : null;
        return onPressSlot ? (
          <AnimatedPressable key={slot} style={[styles.cell, { width: cellSize, height: cellSize }, fixed && styles.fixed, isSelected && styles.selected]} onPress={() => onPressSlot(slot)} accessibilityRole="button" accessibilityState={{ selected: isSelected, disabled: !!fixed }} accessibilityLabel={label(cell, slot)} testID={`${testID}-slot-${slot}`}>
            {content}
            {fixed ? (
              <View style={styles.lock}>
                <Lock size={10} color={colors.textMuted} strokeWidth={2.5} />
              </View>
            ) : null}
          </AnimatedPressable>
        ) : (
          <View key={slot} style={[styles.cell, { width: cellSize, height: cellSize }]} accessible accessibilityRole="image" accessibilityLabel={label(cell, slot)} testID={`${testID}-slot-${slot}`}>
            {content}
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
  content: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  body: { ...textStyles.body, color: colors.textPrimary },
  bodyLarge: { fontSize: 19, lineHeight: 27 },
  meta: { ...textStyles.small, color: colors.textSecondary },
  label: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary, marginTop: spacing.xs },
  picker: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  pickerItem: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceElevated, borderWidth: 1.5, borderColor: colors.borderSubtle },
  pickerItemOn: { borderColor: colors.primary, borderWidth: 2.5 },
  pickerText: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  boards: { flexDirection: 'row', gap: spacing.md },
  boardColumn: { gap: spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', borderRadius: cardRadii.compact, overflow: 'hidden', backgroundColor: '#EADCC0', padding: 2 },
  cell: { alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth * 2, borderColor: 'rgba(47,82,51,0.25)' },
  fixed: { backgroundColor: 'rgba(47,82,51,0.06)' },
  lock: { position: 'absolute', top: 4, right: 4 },
  selected: { borderWidth: 3, borderColor: colors.primary },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  tray: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  trayPiece: { width: 72, minHeight: 72, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1.5, borderColor: colors.borderSubtle },
  pieceCaption: { ...textStyles.small, color: colors.textSecondary },
  card: { gap: spacing.xs, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle, marginTop: spacing.sm },
  cardTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  motifRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, alignSelf: 'flex-start' },
  linkText: { ...textStyles.small, fontWeight: '700', color: colors.primary },
});
