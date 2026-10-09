import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PanResponder, Pressable, StyleSheet, View } from 'react-native';

import type { SymmetryMode } from '@/services/culture/symmetry';
import { colors } from '@/theme';

import { getMotifShape } from '../motifs';
import { cellKey, GRID, resultOf, type Cell, type Piece } from './playgroundModel';

/** The motif colour used on the playground grids. */
export const INK = colors.primary;

/*
 * The 5 x 5 grids shared by the Symmetry Playground and Remember the
 * Pattern: an editable source grid (tap / pick up and move / drag) and a
 * read-only result grid with optional guide lines.
 */
/**
 * The editable grid. Tap a cell (place / pick up / move there) - the
 * Pressable cells are the accessible, keyboard and screen-reader path.
 * Dragging: the GRID (an ancestor of every cell, so it may take over a
 * touch the cell started) claims the gesture once it moves, and drops the
 * motif on the cell it is released over (by whole cells).
 */
export function SourceGrid({ size, pieces, selected, name, onTapCell, onDrop }: { size: number; pieces: Piece[]; selected: string | null; name: (id: string) => string; onTapCell: (cell: Cell) => void; onDrop: (piece: Piece, cell: Cell) => void }) {
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
export function ResultGrid({ size, marks, mode, guides, name, testID }: { size: number; marks: ReturnType<typeof resultOf>; mode: SymmetryMode; guides: boolean; name: (id: string) => string; testID: string }) {
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
  grid: { position: 'relative', borderRadius: 8, overflow: 'hidden', backgroundColor: '#EADCC0', borderWidth: 1, borderColor: colors.borderSubtle },
  cell: { position: 'absolute', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(43,32,25,0.18)', alignItems: 'center', justifyContent: 'center' },
  cellSelected: { borderWidth: 3, borderColor: colors.primary, borderStyle: 'dashed' },
  cellLifted: { zIndex: 2 },
  piece: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  mark: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  guide: { position: 'absolute', backgroundColor: colors.accentTerracotta },
  guideVertical: { top: 0, bottom: 0, width: 2 },
  guideHorizontal: { left: 0, right: 0, height: 2 },
});
