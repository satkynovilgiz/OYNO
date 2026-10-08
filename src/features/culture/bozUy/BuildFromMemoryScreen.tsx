import { router } from 'expo-router';
import { Check, ChevronLeft, Lightbulb } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button, IconButton } from '@/components/ui';
import { announce } from '@/services/a11y/announce';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { BOZ_UY_STEPS, type BozUyStepId } from '@/services/culture/bozUySteps';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { BozUyPartIllustration } from './components/BozUyPartIllustration';
import { InlineBoldText } from './components/InlineBoldText';
import { choicesFor, isComplete, keepAttempt, memoryReducer, nextIndex, ORDER, resumeAttempt, review, startAttempt, summary, type MemoryAttempt, type MemoryMode } from './memoryModel';

const stepOf = (id: BozUyStepId) => BOZ_UY_STEPS.find((step) => step.id === id)!;

/**
 * /culture/boz-uy/memory - "Build from Memory" (memoryModel.ts). Tap the
 * part that comes next in the guided builder's own order. Wrong picks are
 * explained with that part's authored tip; a hint shows the next step's
 * tip. The attempt survives opening the source article (in memory). No
 * XP, no achievements - practice only.
 */
export function BuildFromMemoryScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const large = experience === 'child';
  const [mode, setMode] = useState<MemoryMode>('practice');
  const [attempt, setAttemptState] = useState<MemoryAttempt | null>(() => resumeAttempt());
  const setAttempt = (next: MemoryAttempt | null) => {
    keepAttempt(next);
    setAttemptState(next);
  };
  const name = (id: BozUyStepId) => t(stepOf(id).nameKey);
  const act = (action: Parameters<typeof memoryReducer>[1]) => {
    if (!attempt) return;
    const next = memoryReducer(attempt, action);
    if (action.type === 'choose' && next !== attempt) announce(next.lastWrong ? t('culture.bozUy.memory.notYet', { name: name(action.part) }) : t('culture.bozUy.memory.correct', { name: name(action.part) }));
    setAttempt(next);
  };

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
      <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
        {t('culture.bozUy.memory.title')}
      </Text>
    </View>
  );
  const readArticle = <Button label={t('culture.bozUy.memory.readArticle')} variant="text" onPress={() => router.push('/culture/item/boz-uy-overview' as never)} testID="memory-read" />;

  // Guided introduction + mode choice.
  if (!attempt) {
    return (
      <View style={styles.root}>
        {header}
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} testID="memory-intro">
          <Text style={styles.section} accessibilityRole="header">
            {t('culture.bozUy.memory.introTitle')}
          </Text>
          <Text style={[styles.body, large && styles.bodyLarge]}>{t('culture.bozUy.memory.intro')}</Text>
          <Text style={styles.meta}>{t('culture.bozUy.memory.introNote')}</Text>
          <Text style={styles.section}>{t('culture.bozUy.memory.partsTitle')}</Text>
          <View style={styles.partsRow}>
            {ORDER.map((id) => (
              <View key={id} style={styles.partChip} accessible accessibilityLabel={name(id)}>
                <BozUyPartIllustration stepId={id} size={48} />
                <Text style={styles.meta}>{name(id)}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.section} accessibilityRole="header">
            {t('culture.bozUy.memory.modeTitle')}
          </Text>
          <View style={styles.stack} accessibilityRole="radiogroup" accessibilityLabel={t('culture.bozUy.memory.modeTitle')}>
            {(['practice', 'challenge'] as const).map((option) => {
              const on = option === mode;
              return (
                <AnimatedPressable key={option} style={[styles.mode, on && styles.modeOn]} onPress={() => setMode(option)} accessibilityRole="radio" accessibilityState={{ checked: on }} aria-checked={on} accessibilityLabel={`${t(`culture.bozUy.memory.${option}`)}. ${t(`culture.bozUy.memory.${option}Hint`)}`} testID={`memory-mode-${option}`}>
                  <Text style={styles.bodyBold}>{t(`culture.bozUy.memory.${option}`)}</Text>
                  <Text style={styles.meta}>{t(`culture.bozUy.memory.${option}Hint`)}</Text>
                </AnimatedPressable>
              );
            })}
          </View>
          <Button label={t('culture.bozUy.memory.start')} size="lg" onPress={() => setAttempt(startAttempt(mode))} testID="memory-start" />
          <Button label={t('culture.bozUy.memory.backToBuilder')} variant="text" onPress={() => router.replace('/culture/boz-uy/build' as never)} />
        </ScrollView>
      </View>
    );
  }

  const placedList = (
    <View style={styles.stack} testID="memory-placed">
      <Text style={styles.section}>{t('culture.bozUy.memory.placedTitle')}</Text>
      {attempt.placed.length === 0 ? <Text style={styles.meta}>{t('culture.bozUy.memory.nothingYet')}</Text> : null}
      <View style={styles.partsRow}>
        {attempt.placed.map((id, index) => (
          <View key={id} style={[styles.partChip, styles.partPlaced]} accessible accessibilityLabel={`${index + 1}. ${name(id)}`} testID={`memory-placed-${index}`}>
            <BozUyPartIllustration stepId={id} size={48} />
            <Text style={styles.meta}>
              {index + 1}. {name(id)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );

  // Final reconstruction and review.
  if (isComplete(attempt)) {
    const totals = summary(attempt);
    return (
      <View style={styles.root}>
        {header}
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} testID="memory-done">
          <Text style={styles.heading} accessibilityRole="header">
            {t('culture.bozUy.memory.doneTitle')}
          </Text>
          {review(attempt).map((row) => {
            const step = stepOf(row.part);
            const notes = [row.hinted ? t('culture.bozUy.memory.neededHint') : null, row.wrongTries.length ? t('culture.bozUy.memory.triedFirst', { names: row.wrongTries.map(name).join(', ') }) : null].filter(Boolean).join(' · ') || t('culture.bozUy.memory.firstTime');
            return (
              <View key={row.part} style={styles.reviewRow} testID={`memory-review-${row.index}`}>
                <BozUyPartIllustration stepId={row.part} size={56} />
                <View style={styles.flex}>
                  <Text style={styles.bodyBold}>
                    {row.index + 1}. {t(step.nameKey)}
                  </Text>
                  <InlineBoldText text={t(step.tipKey)} style={styles.meta} />
                  <Text style={[styles.meta, (row.hinted || row.wrongTries.length > 0) && styles.reviewFlag]}>{notes}</Text>
                </View>
              </View>
            );
          })}
          <Text style={styles.bodyBold} testID="memory-summary">
            {t('culture.bozUy.memory.firstTry', { count: totals.firstTry, total: totals.total })}
          </Text>
          <Text style={styles.note}>{t('culture.bozUy.memory.practiceNote')}</Text>
          {readArticle}
          <Button label={t('culture.bozUy.memory.restart')} onPress={() => act({ type: 'restart' })} testID="memory-restart" />
          <Button label={t('culture.bozUy.memory.changeMode')} variant="secondary" onPress={() => setAttempt(null)} testID="memory-change-mode" />
        </ScrollView>
      </View>
    );
  }

  const index = nextIndex(attempt);
  const target = BOZ_UY_STEPS[index];
  const hinted = attempt.hinted.includes(index);
  const wrongStep = attempt.lastWrong ? stepOf(attempt.lastWrong) : null;
  return (
    <View style={styles.root}>
      {header}
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} testID="memory-play">
        <Text style={styles.meta} testID="memory-progress">
          {t(`culture.bozUy.memory.${attempt.mode}`)} · {t('culture.bozUy.memory.stepOf', { current: index + 1, total: ORDER.length })}
        </Text>
        {placedList}
        <Text style={[styles.heading, large && styles.bodyLarge]} accessibilityRole="header">
          {t('culture.bozUy.memory.whichNext')}
        </Text>
        <View style={styles.choices}>
          {choicesFor(attempt).map((id) => {
            const step = stepOf(id);
            const tried = (attempt.wrong[index] ?? []).includes(id);
            return (
              <AnimatedPressable key={id} style={[styles.choice, tried && styles.choiceTried]} onPress={() => act({ type: 'choose', part: id })} accessibilityRole="button" accessibilityLabel={attempt.mode === 'practice' ? t('culture.bozUy.memory.choiceA11y', { name: t(step.nameKey), description: t(step.descriptionKey) }) : t(step.nameKey)} testID={`memory-choice-${id}`}>
                <BozUyPartIllustration stepId={id} size={large ? 88 : 72} />
                <Text style={[styles.bodyBold, large && styles.bodyLarge]}>{t(step.nameKey)}</Text>
                {attempt.mode === 'practice' ? <Text style={styles.meta}>{t(step.descriptionKey)}</Text> : null}
              </AnimatedPressable>
            );
          })}
        </View>

        {wrongStep ? (
          <View style={styles.explain} accessibilityLiveRegion="polite" testID="memory-wrong">
            <Text style={styles.bodyBold}>{t('culture.bozUy.memory.notYet', { name: t(wrongStep.nameKey) })}</Text>
            <InlineBoldText text={t(wrongStep.tipKey)} style={styles.body} />
          </View>
        ) : null}

        {hinted ? (
          <View style={styles.hint} testID="memory-hint">
            <View style={styles.hintTitle}>
              <Lightbulb size={16} color={colors.accentGoldPressed} />
              <Text style={styles.bodyBold}>{t('culture.bozUy.memory.hintLabel')}</Text>
            </View>
            <InlineBoldText text={t(target.tipKey)} style={styles.body} />
          </View>
        ) : (
          <Button label={t('culture.bozUy.memory.hint')} variant="secondary" icon={<Lightbulb size={16} color={colors.primary} />} onPress={() => act({ type: 'hint' })} testID="memory-hint-button" />
        )}
        {attempt.placed.length > 0 ? (
          <View style={styles.row}>
            <Check size={14} color={colors.primary} />
            <Text style={styles.meta}>{t('culture.bozUy.memory.correct', { name: name(attempt.placed[attempt.placed.length - 1]) })}</Text>
          </View>
        ) : null}
        {readArticle}
        <Button label={t('culture.bozUy.memory.restart')} variant="text" onPress={() => act({ type: 'restart' })} testID="memory-restart" />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  stack: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  flex: { flex: 1, gap: 2 },
  section: { ...typography.overline, color: colors.textSecondary },
  heading: { ...textStyles.h2, color: colors.textPrimary },
  body: { ...textStyles.body, color: colors.textPrimary },
  bodyBold: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  bodyLarge: { fontSize: 20, lineHeight: 28 },
  meta: { ...textStyles.small, color: colors.textSecondary },
  note: { ...textStyles.small, color: colors.textPrimary, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceMuted },
  partsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  partChip: { alignItems: 'center', gap: 2, padding: spacing.xs, minWidth: 72, borderRadius: cardRadii.compact, backgroundColor: colors.surface },
  partPlaced: { borderWidth: 1, borderColor: colors.primary },
  mode: { gap: 2, padding: spacing.md, minHeight: 56, borderRadius: cardRadii.compact, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSubtle },
  modeOn: { borderWidth: 2, borderColor: colors.primary },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choice: { flexGrow: 1, flexBasis: '45%', minWidth: 130, alignItems: 'center', gap: 4, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 2, borderColor: colors.borderSubtle },
  choiceTried: { borderStyle: 'dashed', borderColor: colors.accentTerracotta },
  explain: { gap: 4, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceAlt, borderLeftWidth: 3, borderLeftColor: colors.accentTerracotta },
  hint: { gap: 4, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surface, borderLeftWidth: 3, borderLeftColor: colors.accentGold },
  hintTitle: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reviewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surface },
  reviewFlag: { color: colors.textPrimary, fontWeight: '700' },
});
