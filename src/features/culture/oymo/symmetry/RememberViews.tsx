import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable, Button } from '@/components/ui';
import { announce } from '@/services/a11y/announce';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { cellKey, type Cell } from './playgroundModel';
import { ResultGrid, SourceGrid } from './PlaygroundGrids';
import { rememberReducer, type RememberAction, type RememberPattern, type RememberState } from './rememberModel';

/** One extra motif on offer, so the choice isn't given away by the picker. */
export const DISTRACTORS = ['gul', 'muyuz', 'bulak', 'jalbyrak', 'tortKulak', 'kochkorMuyuz'];

/**
 * Pieces of Remember the Pattern shared by the solo game and the
 * two-player mode: the reference (grid + the same pattern as a described
 * list), the rebuild editor with gentle feedback, the choice chips and the
 * optional viewing countdown.
 */

/** Optional timed viewing: counts down while `viewing`, then calls `onElapsed`. `views` restarts it after "Show again". */
export function useViewCountdown(viewing: boolean, viewTime: number | null, views: number, onElapsed: () => void): number | null {
  const [left, setLeft] = useState<number | null>(null);
  const elapsed = useRef(onElapsed);
  elapsed.current = onElapsed;
  useEffect(() => {
    if (!viewing || !viewTime) {
      setLeft(null);
      return;
    }
    setLeft(viewTime);
    const timer = setInterval(() => setLeft((value) => (value === null ? null : value - 1)), 1000);
    return () => clearInterval(timer);
  }, [viewing, viewTime, views]);
  useEffect(() => {
    if (left === 0) elapsed.current();
  }, [left]);
  return left;
}

export function ChoiceGroup<T extends string | number | null>({ heading, options, value, label, onSelect, id, large }: { heading: string; options: readonly T[]; value: T; label: (option: T) => string; onSelect: (option: T) => void; id: string; large?: boolean }) {
  return (
    <View style={rememberStyles.group}>
      <Text style={rememberStyles.section} accessibilityRole="header">
        {heading}
      </Text>
      <View style={rememberStyles.chips} accessibilityRole="radiogroup" accessibilityLabel={heading}>
        {options.map((option) => {
          const on = option === value;
          return (
            <AnimatedPressable key={String(option)} style={[rememberStyles.chip, large && rememberStyles.chipLarge, on && rememberStyles.chipOn]} onPress={() => onSelect(option)} accessibilityRole="radio" accessibilityState={{ checked: on }} aria-checked={on} accessibilityLabel={label(option)} testID={`remember-${id}-${option ?? 'untimed'}`}>
              <Text style={[rememberStyles.chipText, on && rememberStyles.chipTextOn]}>{label(option)}</Text>
            </AnimatedPressable>
          );
        })}
      </View>
    </View>
  );
}

/** The pattern described in words, row by row (the screen-reader equivalent of the grid). */
export function describedLines(pattern: RememberPattern, t: (key: string, options?: Record<string, unknown>) => string, name: (id: string) => string): string[] {
  return pattern.marks.map((mark) => t('rememberPattern.describedRow', { row: mark.cell.row + 1, col: mark.cell.col + 1, name: name(mark.motifId) }));
}

export function ReferenceView({ pattern, size, left, name, onHide, title }: { pattern: RememberPattern; size: number; left: number | null; name: (id: string) => string; onHide: () => void; title?: string }) {
  const { t } = useTranslation();
  return (
    <View style={rememberStyles.stack} testID="remember-viewing">
      <Text style={rememberStyles.heading} accessibilityRole="header">
        {title ?? t('rememberPattern.lookTitle')}
      </Text>
      <ResultGrid size={size} marks={pattern.marks.map((mark) => ({ ...mark, source: true }))} mode="none" guides={false} name={name} testID="remember-reference" />
      {/* The same reference as a list - the equivalent for screen-reader users (and anyone who prefers words). */}
      <View style={rememberStyles.card} testID="remember-described">
        <Text style={rememberStyles.label}>{t('rememberPattern.describedTitle')}</Text>
        {describedLines(pattern, t, name).map((line) => (
          <Text key={line} style={rememberStyles.meta}>
            {line}
          </Text>
        ))}
      </View>
      {left !== null ? (
        <Text style={rememberStyles.status} accessibilityLiveRegion="polite" testID="remember-time-left">
          {t('rememberPattern.timeLeft', { count: left })}
        </Text>
      ) : null}
      <Button label={t('rememberPattern.hide')} size="lg" onPress={onHide} testID="remember-hide" />
    </View>
  );
}

export function RebuildView({ state, size, motifs, motif, onMotif, selected, onSelect, large, name, onAction, title }: { state: RememberState; size: number; motifs: string[]; motif: string; onMotif: (id: string) => void; selected: string | null; onSelect: (id: string | null | ((current: string | null) => string | null)) => void; large: boolean; name: (id: string) => string; onAction: (action: RememberAction) => void; title?: string }) {
  const { t } = useTranslation();
  const design = state.editor.design;
  const selectedPiece = design.pieces.find((piece) => piece.id === selected) ?? null;
  const tapCell = (cell: Cell) => {
    const piece = design.pieces.find((entry) => cellKey(entry.cell) === cellKey(cell));
    if (piece) return onSelect((current) => (current === piece.id ? null : piece.id));
    if (selectedPiece) {
      onAction({ type: 'edit', action: { type: 'move', id: selectedPiece.id, cell } });
      onSelect(null);
    } else onAction({ type: 'edit', action: { type: 'place', cell, motifId: motif } });
  };
  const check = () => {
    const next = rememberReducer(state, { type: 'check' });
    announce(next.feedback?.solved ? t('rememberPattern.doneTitle') : t('rememberPattern.keepGoing'));
    onAction({ type: 'check' });
  };
  return (
    <View style={rememberStyles.stack} testID="remember-building">
      <Text style={rememberStyles.heading} accessibilityRole="header">
        {title ?? t('rememberPattern.buildTitle')}
      </Text>
      <ChoiceGroup heading={t('rememberPattern.motifTitle')} options={motifs} value={motif} label={name} onSelect={onMotif} id="motif" large={large} />
      <SourceGrid size={size} pieces={design.pieces} selected={selected} name={name} onTapCell={tapCell} onDrop={(piece, cell) => onAction({ type: 'edit', action: { type: 'move', id: piece.id, cell } })} />
      <View style={rememberStyles.row}>
        <Button label={t('rememberPattern.check')} onPress={check} disabled={design.pieces.length === 0} testID="remember-check" />
        <Button label={t('rememberPattern.undo')} variant="secondary" disabled={state.editor.history.length === 0} onPress={() => onAction({ type: 'edit', action: { type: 'undo' } })} testID="remember-undo" />
        {selectedPiece ? (
          <Button
            label={t('rememberPattern.remove')}
            variant="secondary"
            onPress={() => {
              onAction({ type: 'edit', action: { type: 'remove', id: selectedPiece.id } });
              onSelect(null);
            }}
            testID="remember-remove"
          />
        ) : null}
        <Button label={t('rememberPattern.showAgain')} variant="text" onPress={() => onAction({ type: 'showAgain' })} testID="remember-show-again" />
      </View>
      {state.feedback && !state.feedback.solved ? (
        <View style={rememberStyles.feedback} accessibilityLiveRegion="polite" testID="remember-feedback">
          <Text style={rememberStyles.bodyBold}>{t('rememberPattern.feedbackSome', { matched: state.feedback.matched })}</Text>
          {state.feedback.missing > 0 ? <Text style={rememberStyles.body}>{t('rememberPattern.missing', { count: state.feedback.missing })}</Text> : null}
          {state.feedback.wrongMotif > 0 ? <Text style={rememberStyles.body}>{t('rememberPattern.wrongMotif', { count: state.feedback.wrongMotif })}</Text> : null}
          {state.feedback.extra > 0 ? <Text style={rememberStyles.body}>{t('rememberPattern.extra', { count: state.feedback.extra })}</Text> : null}
          <Text style={rememberStyles.meta}>{t('rememberPattern.keepGoing')}</Text>
        </View>
      ) : null}
    </View>
  );
}

export const rememberStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  stack: { gap: spacing.sm, alignItems: 'stretch' },
  group: { gap: spacing.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  section: { ...typography.overline, color: colors.textSecondary },
  label: { ...textStyles.overline, color: colors.primary },
  heading: { ...textStyles.h2, color: colors.textPrimary },
  body: { ...textStyles.body, color: colors.textPrimary },
  bodyBold: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  bodyLarge: { fontSize: 19, lineHeight: 28 },
  meta: { ...textStyles.small, color: colors.textSecondary },
  note: { ...textStyles.small, color: colors.textPrimary, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceMuted },
  status: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.primary },
  card: { gap: 2, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surface },
  feedback: { gap: 2, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceAlt, borderLeftWidth: 3, borderLeftColor: colors.accentGold },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { minHeight: 44, paddingHorizontal: spacing.md, justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.surface },
  chipLarge: { minHeight: 52 },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...textStyles.bodyMedium, color: colors.textPrimary },
  chipTextOn: { color: colors.textOnPrimary, fontWeight: '700' },
});
