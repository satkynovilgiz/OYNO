import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useReducer, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button, IconButton } from '@/components/ui';
import { announce } from '@/services/a11y/announce';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { handOffToCreator } from '@/services/culture/oymoHandoff';
import { spacing } from '@/theme';

import { assisted, attemptReducer, CHANGED_CELLS, cellRows, generateChallenge, hintRow, LEVELS, startAttempt, toCreatorCopy, toMarks, type Attempt, type AttemptAction, type Change, type Content, type DetectiveMark } from './detectiveModel';
import { cellKey, type Cell } from './playgroundModel';
import { ResultGrid } from './PlaygroundGrids';
import type { Level } from './rememberModel';
import { ChoiceGroup, rememberStyles as styles } from './RememberViews';

/**
 * /culture/oymo/pattern-detective - find the changed cells between an
 * original pattern and a modified copy (detectiveModel.ts). Untimed; an
 * optional hint names the row of one change and marks the attempt as
 * assisted. A list gives every drawn cell's original and modified motif
 * and colour, with the same mark controls. No animation; offline; nothing
 * is stored.
 */
export function PatternDetectiveScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { experience } = useAgeExperience();
  const large = experience === 'child';
  const [level, setLevel] = useState<Level>('easy');
  const [state, dispatch] = useReducer((current: Attempt | null, action: AttemptAction | { type: 'begin'; attempt: Attempt } | { type: 'quit' }) => (action.type === 'begin' ? action.attempt : action.type === 'quit' ? null : current ? attemptReducer(current, action) : current), null);
  const wide = width >= 640;
  const size = Math.min(wide ? (width - spacing.lg * 2 - spacing.md) / 2 : width - spacing.lg * 2, 300);
  const motif = (id: string) => t(`culture.oymo.motifs.${id}`);
  const describe = (content: Content | null) => (content ? t('patternDetective.content', { motif: motif(content.motifId), color: t(`patternDetective.colors.${content.color}`) }) : t('patternDetective.emptyCell'));
  const where = (cell: Cell) => t('patternDetective.where', { row: cell.row + 1, col: cell.col + 1 });

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
      <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
        {t('patternDetective.title')}
      </Text>
    </View>
  );
  const begin = () => dispatch({ type: 'begin', attempt: startAttempt(generateChallenge(level)) });

  if (!state) {
    return (
      <View style={styles.root}>
        {header}
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} testID="detective-setup">
          <Text style={[styles.body, large && styles.bodyLarge]}>{t('patternDetective.intro')}</Text>
          <Text style={styles.note}>{t('patternDetective.practiceNote')}</Text>
          <ChoiceGroup heading={t('patternDetective.levelTitle')} options={LEVELS} value={level} label={(option) => t(`patternDetective.levels.${option}`, { count: CHANGED_CELLS[option] })} onSelect={setLevel} id="detective-level" large={large} />
          <Text style={styles.meta}>{t('patternDetective.untimedNote')}</Text>
          <Button label={t('patternDetective.start')} size="lg" onPress={begin} testID="detective-start" />
        </ScrollView>
      </View>
    );
  }

  const { challenge } = state;
  const marked = new Set(state.marked);
  const toggle = (cell: Cell) => dispatch({ type: 'toggle', key: cellKey(cell) });
  const cellLabel = (version: 'original' | 'modified') => (cell: Cell) => {
    const grid = version === 'original' ? challenge.original : challenge.modified;
    const mark = grid.find((entry) => cellKey(entry.cell) === cellKey(cell)) ?? null;
    return `${where(cell)}: ${describe(mark)}. ${marked.has(cellKey(cell)) ? t('patternDetective.markedA11y') : t('patternDetective.notMarkedA11y')}`;
  };
  const open = (grid: readonly DetectiveMark[], which: 'original' | 'modified') => {
    handOffToCreator(toCreatorCopy(grid), { symmetry: 'none', source: 'detective' });
    announce(t(`patternDetective.opened.${which}`));
    router.push('/culture/oymo/create' as never);
  };
  const explain = (change: Change) =>
    change.kind === 'move'
      ? t('patternDetective.explain.move', { motif: motif(change.before.motifId), from: where(change.from), to: where(change.to) })
      : change.kind === 'add'
        ? t('patternDetective.explain.add', { where: where(change.cell), what: describe(change.after) })
        : change.kind === 'remove'
          ? t('patternDetective.explain.remove', { where: where(change.cell), what: describe(change.before) })
          : t(`patternDetective.explain.${change.kind}`, { where: where(change.cell), before: describe(change.before), after: describe(change.after) });
  const doCheck = () => {
    const next = attemptReducer(state, { type: 'check' });
    announce(next.feedback?.solved ? t('patternDetective.solved') : t('patternDetective.keepLooking'));
    dispatch({ type: 'check' });
  };

  return (
    <View style={styles.root}>
      {header}
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} testID="detective-play">
        <Text style={styles.body}>{t('patternDetective.task', { count: challenge.changed.length })}</Text>
        <View style={[styles.row, { alignItems: 'flex-start', justifyContent: 'center' }]}>
          {(['original', 'modified'] as const).map((version) => (
            <View key={version} style={styles.stack}>
              <Text style={styles.label}>{t(`patternDetective.${version}`)}</Text>
              <ResultGrid size={size} marks={toMarks(version === 'original' ? challenge.original : challenge.modified)} mode="none" guides={false} name={motif} testID={`detective-${version}`} onTapCell={state.done ? undefined : toggle} marked={marked} cellLabel={cellLabel(version)} />
            </View>
          ))}
        </View>
        <Text style={styles.meta}>{t('patternDetective.markHint')}</Text>

        {!state.done ? (
          <>
            <Text style={styles.status} accessibilityLiveRegion="polite" testID="detective-marked">
              {t('patternDetective.markedCount', { count: state.marked.length, total: challenge.changed.length })}
            </Text>
            <View style={styles.row}>
              <Button label={t('patternDetective.check')} onPress={doCheck} disabled={state.marked.length === 0} testID="detective-check" />
              <Button label={t('patternDetective.hint')} variant="secondary" onPress={() => dispatch({ type: 'hint' })} disabled={state.hints.length >= challenge.changed.length} testID="detective-hint" />
            </View>
            {state.hints.length ? (
              <View style={styles.card} testID="detective-hints">
                {state.hints.map((key) => (
                  <Text key={key} style={styles.body}>
                    {t('patternDetective.hintText', { row: hintRow(key) })}
                  </Text>
                ))}
              </View>
            ) : null}
            {state.feedback ? (
              <View style={styles.feedback} accessibilityLiveRegion="polite" testID="detective-feedback">
                <Text style={styles.bodyBold}>{t('patternDetective.found', { count: state.feedback.found, total: challenge.changed.length })}</Text>
                {state.feedback.missed > 0 ? <Text style={styles.body}>{t('patternDetective.missed', { count: state.feedback.missed })}</Text> : null}
                {state.feedback.extra > 0 ? <Text style={styles.body}>{t('patternDetective.extra', { count: state.feedback.extra })}</Text> : null}
                <Text style={styles.meta}>{t('patternDetective.keepLooking')}</Text>
              </View>
            ) : null}
          </>
        ) : (
          <View style={styles.stack} testID="detective-done">
            <Text style={styles.heading} accessibilityRole="header">
              {t('patternDetective.solved')}
            </Text>
            <Text style={styles.bodyBold} testID="detective-assisted">
              {assisted(state) ? t('patternDetective.assisted') : t('patternDetective.unassisted')}
            </Text>
            <Text style={styles.body}>{t('patternDetective.checks', { count: state.checks })}</Text>
            <View style={styles.card} testID="detective-explanation">
              <Text style={styles.label}>{t('patternDetective.explanationTitle')}</Text>
              {challenge.changes.map((change, index) => (
                <Text key={index} style={styles.body}>
                  • {explain(change)}
                </Text>
              ))}
            </View>
            <Button label={t('patternDetective.openOriginal')} variant="secondary" accessibilityHint={t('patternDetective.openHint')} onPress={() => open(challenge.original, 'original')} testID="detective-open-original" />
            <Button label={t('patternDetective.openModified')} variant="secondary" accessibilityHint={t('patternDetective.openHint')} onPress={() => open(challenge.modified, 'modified')} testID="detective-open-modified" />
            <Text style={styles.meta}>{t('patternDetective.openHint')}</Text>
            <Button label={t('patternDetective.another')} onPress={begin} testID="detective-another" />
            <Button label={t('patternDetective.changeLevel')} variant="text" onPress={() => dispatch({ type: 'quit' })} testID="detective-change-level" />
          </View>
        )}

        {/* The same information as words: every drawn cell, original vs modified, with the same mark control. */}
        <View style={styles.card} testID="detective-list">
          <Text style={styles.label} accessibilityRole="header">
            {t('patternDetective.listTitle')}
          </Text>
          {cellRows(challenge).map((row) => {
            const on = marked.has(row.key);
            return (
              <AnimatedPressable key={row.key} style={[styles.chip, { borderRadius: 12, paddingVertical: spacing.xs }, on && styles.chipOn]} disabled={state.done} onPress={() => toggle(row.cell)} accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled: state.done }} aria-checked={on} testID={`detective-row-${row.cell.col}-${row.cell.row}`}>
                <Text style={[styles.chipText, on && styles.chipTextOn]}>
                  {where(row.cell)} - {t('patternDetective.original')}: {describe(row.original)}; {t('patternDetective.modified')}: {describe(row.modified)}
                </Text>
              </AnimatedPressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
