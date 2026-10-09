import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useEffect, useReducer, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button, IconButton } from '@/components/ui';
import { announce } from '@/services/a11y/announce';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { handOffToCreator } from '@/services/culture/oymoHandoff';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { cellKey, toCreatorCopy, type Cell } from './playgroundModel';
import { INK, ResultGrid, SourceGrid } from './PlaygroundGrids';
import { LEVELS, motifsOf, REMEMBER_PATTERNS, rememberReducer, startRemember, VIEW_TIMES, type Level, type RememberState, type ViewTime } from './rememberModel';

/** One extra motif on offer, so the choice isn't given away by the picker. */
const DISTRACTORS = ['gul', 'muyuz', 'bulak', 'jalbyrak', 'tortKulak', 'kochkorMuyuz'];

/**
 * /culture/oymo/remember - Remember the Pattern (rememberModel.ts). Look
 * (untimed by default, or 10/20 s), hide it when ready, rebuild it on the
 * playground's own grid, Check. "Show again" is always there and marks the
 * attempt as assisted. The reference is also given as a described list,
 * for screen readers. Finished patterns open in the Creator as unsaved
 * copies. Local only; nothing is measured or stored.
 */
export function RememberPatternScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { experience } = useAgeExperience();
  const large = experience === 'child';
  const [level, setLevel] = useState<Level>('easy');
  const [viewTime, setViewTime] = useState<ViewTime>(null);
  const [round, setRound] = useState(0);
  const [state, dispatchState] = useReducer((current: RememberState | null, action: Parameters<typeof rememberReducer>[1] | { type: 'begin'; state: RememberState } | { type: 'quit' }) => (action.type === 'begin' ? action.state : action.type === 'quit' ? null : current ? rememberReducer(current, action) : current), null);
  const [motif, setMotif] = useState<string>('gul');
  const [selected, setSelected] = useState<string | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const size = Math.min(width - spacing.lg * 2, 320);
  const name = (id: string) => t(`culture.oymo.motifs.${id}`);

  // Optional timed viewing: counts down, then hides; hiding early is always possible.
  const viewing = state?.phase === 'viewing';
  useEffect(() => {
    if (!viewing || !state?.viewTime) {
      setLeft(null);
      return;
    }
    setLeft(state.viewTime);
    const timer = setInterval(() => setLeft((value) => (value === null ? null : value - 1)), 1000);
    return () => clearInterval(timer);
  }, [viewing, state?.viewTime, state?.views]);
  useEffect(() => {
    if (left === 0) dispatchState({ type: 'hide' });
  }, [left]);

  const begin = (nextLevel: Level) => {
    const options = REMEMBER_PATTERNS.filter((pattern) => pattern.level === nextLevel);
    const pattern = options[round % options.length];
    setRound((value) => value + 1);
    setMotif(motifsOf(pattern)[0]);
    setSelected(null);
    dispatchState({ type: 'begin', state: startRemember(pattern, viewTime) });
  };

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
      <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
        {t('rememberPattern.title')}
      </Text>
    </View>
  );

  const radio = <T extends string | number | null>(heading: string, options: readonly T[], value: T, label: (option: T) => string, onSelect: (option: T) => void, id: string) => (
    <View style={styles.group}>
      <Text style={styles.section} accessibilityRole="header">
        {heading}
      </Text>
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={heading}>
        {options.map((option) => {
          const on = option === value;
          return (
            <AnimatedPressable key={String(option)} style={[styles.chip, large && styles.chipLarge, on && styles.chipOn]} onPress={() => onSelect(option)} accessibilityRole="radio" accessibilityState={{ checked: on }} aria-checked={on} accessibilityLabel={label(option)} testID={`remember-${id}-${option ?? 'untimed'}`}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{label(option)}</Text>
            </AnimatedPressable>
          );
        })}
      </View>
    </View>
  );

  if (!state) {
    return (
      <View style={styles.root}>
        {header}
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} testID="remember-setup">
          <Text style={[styles.body, large && styles.bodyLarge]}>{t('rememberPattern.intro')}</Text>
          <Text style={styles.note}>{t('rememberPattern.practiceNote')}</Text>
          {radio(t('rememberPattern.levelTitle'), LEVELS, level, (option) => `${t(`rememberPattern.levels.${option}`)} · ${t(`rememberPattern.levelHint.${option}`)}`, setLevel, 'level')}
          {radio(t('rememberPattern.viewTitle'), VIEW_TIMES, viewTime, (option) => (option === null ? t('rememberPattern.untimed') : t('rememberPattern.seconds', { count: option })), setViewTime, 'time')}
          <Button label={t('rememberPattern.start')} size="lg" onPress={() => begin(level)} testID="remember-start" />
        </ScrollView>
      </View>
    );
  }

  const { pattern, editor } = state;
  const design = editor.design;
  const described = pattern.marks.map((mark) => t('rememberPattern.describedRow', { row: mark.cell.row + 1, col: mark.cell.col + 1, name: name(mark.motifId) }));
  const motifs = [...motifsOf(pattern), ...DISTRACTORS.filter((id) => !motifsOf(pattern).includes(id)).slice(0, 1)];
  const selectedPiece = design.pieces.find((piece) => piece.id === selected) ?? null;
  const edit = (action: Parameters<typeof rememberReducer>[1]) => dispatchState(action);
  const tapCell = (cell: Cell) => {
    const piece = design.pieces.find((entry) => cellKey(entry.cell) === cellKey(cell));
    if (piece) return setSelected((current) => (current === piece.id ? null : piece.id));
    if (selectedPiece) {
      edit({ type: 'edit', action: { type: 'move', id: selectedPiece.id, cell } });
      setSelected(null);
    } else edit({ type: 'edit', action: { type: 'place', cell, motifId: motif } });
  };
  const check = () => {
    const next = rememberReducer(state, { type: 'check' });
    announce(next.feedback?.solved ? t('rememberPattern.doneTitle') : t('rememberPattern.keepGoing'));
    dispatchState({ type: 'check' });
  };

  return (
    <View style={styles.root}>
      {header}
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>
        {state.phase === 'viewing' ? (
          <View style={styles.stack} testID="remember-viewing">
            <Text style={styles.heading} accessibilityRole="header">
              {t('rememberPattern.lookTitle')}
            </Text>
            <ResultGrid size={size} marks={pattern.marks.map((mark) => ({ ...mark, source: true }))} mode="none" guides={false} name={name} testID="remember-reference" />
            {/* The same reference as a list - the equivalent for screen-reader users (and anyone who prefers words). */}
            <View style={styles.card} testID="remember-described">
              <Text style={styles.label}>{t('rememberPattern.describedTitle')}</Text>
              {described.map((line) => (
                <Text key={line} style={styles.meta}>
                  {line}
                </Text>
              ))}
            </View>
            {left !== null ? (
              <Text style={styles.status} accessibilityLiveRegion="polite" testID="remember-time-left">
                {t('rememberPattern.timeLeft', { count: left })}
              </Text>
            ) : null}
            <Button label={t('rememberPattern.hide')} size="lg" onPress={() => edit({ type: 'hide' })} testID="remember-hide" />
          </View>
        ) : null}

        {state.phase === 'building' ? (
          <View style={styles.stack} testID="remember-building">
            <Text style={styles.heading} accessibilityRole="header">
              {t('rememberPattern.buildTitle')}
            </Text>
            {radio(t('rememberPattern.motifTitle'), motifs, motif, name, setMotif, 'motif')}
            <SourceGrid size={size} pieces={design.pieces} selected={selected} name={name} onTapCell={tapCell} onDrop={(piece, cell) => edit({ type: 'edit', action: { type: 'move', id: piece.id, cell } })} />
            <View style={styles.row}>
              <Button label={t('rememberPattern.check')} onPress={check} disabled={design.pieces.length === 0} testID="remember-check" />
              <Button label={t('rememberPattern.undo')} variant="secondary" disabled={editor.history.length === 0} onPress={() => edit({ type: 'edit', action: { type: 'undo' } })} testID="remember-undo" />
              {selectedPiece ? (
                <Button
                  label={t('rememberPattern.remove')}
                  variant="secondary"
                  onPress={() => {
                    edit({ type: 'edit', action: { type: 'remove', id: selectedPiece.id } });
                    setSelected(null);
                  }}
                  testID="remember-remove"
                />
              ) : null}
              <Button label={t('rememberPattern.showAgain')} variant="text" onPress={() => edit({ type: 'showAgain' })} testID="remember-show-again" />
            </View>
            {state.feedback && !state.feedback.solved ? (
              <View style={styles.feedback} accessibilityLiveRegion="polite" testID="remember-feedback">
                <Text style={styles.bodyBold}>{t('rememberPattern.feedbackSome', { matched: state.feedback.matched })}</Text>
                {state.feedback.missing > 0 ? <Text style={styles.body}>{t('rememberPattern.missing', { count: state.feedback.missing })}</Text> : null}
                {state.feedback.wrongMotif > 0 ? <Text style={styles.body}>{t('rememberPattern.wrongMotif', { count: state.feedback.wrongMotif })}</Text> : null}
                {state.feedback.extra > 0 ? <Text style={styles.body}>{t('rememberPattern.extra', { count: state.feedback.extra })}</Text> : null}
                <Text style={styles.meta}>{t('rememberPattern.keepGoing')}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {state.phase === 'done' ? (
          <View style={styles.stack} testID="remember-done">
            <Text style={styles.heading} accessibilityRole="header">
              {t('rememberPattern.doneTitle')}
            </Text>
            <ResultGrid size={size} marks={design.pieces.map((piece) => ({ cell: piece.cell, motifId: piece.motifId, source: true }))} mode="none" guides={false} name={name} testID="remember-result" />
            <Text style={styles.body}>{t('rememberPattern.doneChecks', { count: state.checks })}</Text>
            <Text style={styles.bodyBold} testID="remember-assisted">
              {state.assisted ? t('rememberPattern.assisted') : t('rememberPattern.unassisted')}
            </Text>
            <Text style={styles.note}>{t('rememberPattern.practiceNote')}</Text>
            <Button
              label={t('rememberPattern.openInCreator')}
              accessibilityHint={t('rememberPattern.openInCreatorHint')}
              onPress={() => {
                const copy = toCreatorCopy(design, INK);
                handOffToCreator(copy.state, { symmetry: 'none', source: 'remember' });
                router.push('/culture/oymo/create' as never);
              }}
              testID="remember-open-creator"
            />
            <Button label={t('rememberPattern.restart')} variant="secondary" onPress={() => edit({ type: 'restart' })} testID="remember-restart" />
            <Button label={t('rememberPattern.another')} variant="text" onPress={() => dispatchState({ type: 'quit' })} testID="remember-another" />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
