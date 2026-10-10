import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useReducer, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconButton } from '@/components/ui';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { handOffToCreator } from '@/services/culture/oymoHandoff';
import { spacing } from '@/theme';

import { toCreatorCopy } from './playgroundModel';
import { INK, ResultGrid } from './PlaygroundGrids';
import { LEVELS, motifsOf, REMEMBER_PATTERNS, rememberReducer, startRemember, VIEW_TIMES, type Level, type RememberState, type ViewTime } from './rememberModel';
import { ChoiceGroup, DISTRACTORS, RebuildView, ReferenceView, rememberStyles, useViewCountdown } from './RememberViews';

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
  const size = Math.min(width - spacing.lg * 2, 320);
  const name = (id: string) => t(`culture.oymo.motifs.${id}`);

  // Optional timed viewing: counts down, then hides; hiding early is always possible.
  const left = useViewCountdown(state?.phase === 'viewing', state?.viewTime ?? null, state?.views ?? 0, () => dispatchState({ type: 'hide' }));

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

  if (!state) {
    return (
      <View style={styles.root}>
        {header}
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} testID="remember-setup">
          <Text style={[styles.body, large && styles.bodyLarge]}>{t('rememberPattern.intro')}</Text>
          <Text style={styles.note}>{t('rememberPattern.practiceNote')}</Text>
          <ChoiceGroup heading={t('rememberPattern.levelTitle')} options={LEVELS} value={level} label={(option) => `${t(`rememberPattern.levels.${option}`)} · ${t(`rememberPattern.levelHint.${option}`)}`} onSelect={setLevel} id="level" large={large} />
          <ChoiceGroup heading={t('rememberPattern.viewTitle')} options={VIEW_TIMES} value={viewTime} label={(option) => (option === null ? t('rememberPattern.untimed') : t('rememberPattern.seconds', { count: option }))} onSelect={setViewTime} id="time" large={large} />
          <Button label={t('rememberPattern.start')} size="lg" onPress={() => begin(level)} testID="remember-start" />
          <Button label={t('rememberTogether.entry')} variant="secondary" accessibilityHint={t('rememberTogether.entryHint')} onPress={() => router.push('/culture/oymo/remember-together' as never)} testID="remember-together-entry" />
          <Text style={styles.meta}>{t('rememberTogether.entryHint')}</Text>
        </ScrollView>
      </View>
    );
  }

  const { pattern, editor } = state;
  const design = editor.design;
  const motifs = [...motifsOf(pattern), ...DISTRACTORS.filter((id) => !motifsOf(pattern).includes(id)).slice(0, 1)];
  const edit = (action: Parameters<typeof rememberReducer>[1]) => dispatchState(action);
  return (
    <View style={styles.root}>
      {header}
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>
        {state.phase === 'viewing' ? <ReferenceView pattern={pattern} size={size} left={left} name={name} onHide={() => edit({ type: 'hide' })} /> : null}

        {state.phase === 'building' ? <RebuildView state={state} size={size} motifs={motifs} motif={motif} onMotif={setMotif} selected={selected} onSelect={setSelected} large={large} name={name} onAction={edit} /> : null}

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

const styles = rememberStyles;
