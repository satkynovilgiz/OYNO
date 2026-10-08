import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button, IconButton } from '@/components/ui';
import { useRecordsOwner } from '@/features/games/records/useGameRecords';
import { announce } from '@/services/a11y/announce';
import { useOymoCreations } from '@/services/content/oymoCreationsService';
import { handOffToCreator } from '@/services/culture/oymoHandoff';
import { useReducedMotion } from '@/services/motion/useReducedMotion';
import { recipeFor, useOymoRecipeStore } from '@/store/useOymoRecipeStore';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { OymoArtwork } from '../components/OymoArtwork';
import { sessionRecipe, stageAsCopy, type Recipe, type RecipeStep } from './recipeModel';

const PLAY_MS = 900;

/**
 * /culture/oymo/recipe?creation=<id> | ?source=session - replay how a
 * pattern was built. Every step is a complete stage; the last one is the
 * final design. Play/Pause, Previous/Next and a labelled step list. Any
 * stage opens in the Creator as an unsaved deep copy; the saved creation
 * is never changed. Local only.
 */
export function RecipePlayerScreen({ creationId, onPressBack }: { creationId: string | null; onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const owner = useRecordsOwner();
  const { data: creations, isLoading } = useOymoCreations();
  const saved = useOymoRecipeStore((state) => state.saved);
  const loaded = useOymoRecipeStore((state) => state.isLoaded);
  useEffect(() => {
    void useOymoRecipeStore.getState().load();
  }, []);

  const creation = creationId ? (creations?.find((entry) => entry.id === creationId) ?? null) : null;
  const recipe: Recipe | null = useMemo(() => {
    if (!creationId) return sessionRecipe();
    if (!creation) return null;
    return recipeFor(saved, owner, { layers: creation.layers, backgroundColor: creation.background_color, symmetry: creation.symmetry_mode });
  }, [creationId, creation, saved, owner]);

  const [index, setIndex] = useState(0);
  // Plays by itself on open - unless Reduce Motion is on: then it's manual until Play is pressed.
  const [playing, setPlaying] = useState(!reducedMotion);
  const userPressedPlay = useRef(false);
  // Reduce Motion is reported asynchronously: once it is known, stop the automatic start (not a Play the user pressed).
  useEffect(() => {
    if (reducedMotion && !userPressedPlay.current) setPlaying(false);
  }, [reducedMotion]);
  const total = recipe?.steps.length ?? 0;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!playing || !recipe) return;
    if (index >= total - 1) {
      setPlaying(false);
      return;
    }
    timer.current = setTimeout(() => setIndex((current) => Math.min(current + 1, total - 1)), PLAY_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [playing, index, total, recipe]);

  const labelOf = (step: RecipeStep) => t(`culture.oymo.recipe.labels.${step.label}`, { motif: step.motifId ? t(`culture.oymo.motifs.${step.motifId}`) : '' });
  const go = (next: number) => {
    if (!recipe) return;
    const clamped = Math.max(0, Math.min(total - 1, next));
    setPlaying(false);
    setIndex(clamped);
    announce(t('culture.oymo.recipe.stepA11y', { current: clamped + 1, total, label: labelOf(recipe.steps[clamped]) }));
  };

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
      <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
        {t('culture.oymo.recipe.title')}
      </Text>
    </View>
  );

  if (!recipe) {
    const message = !creationId ? t('culture.oymo.recipe.noSession') : isLoading || !loaded ? '…' : !creation ? t('culture.oymo.recipe.notFound') : t('culture.oymo.recipe.noRecipe');
    return (
      <View style={styles.root}>
        {header}
        <View style={styles.content}>
          <Text style={styles.body} testID="recipe-none">
            {message}
          </Text>
          <Button label={t('culture.oymo.recipe.back')} variant="secondary" onPress={onPressBack} />
        </View>
      </View>
    );
  }

  const step = recipe.steps[index];
  const size = Math.min(width - spacing.lg * 2, 320);
  const openStage = () => {
    const copy = stageAsCopy(recipe, index);
    if (!copy) return;
    handOffToCreator(copy.state, { symmetry: copy.symmetry, source: 'recipe' });
    router.push('/culture/oymo/create' as never);
  };

  return (
    <View style={styles.root}>
      {header}
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>
        {creation ? <Text style={styles.cardTitle}>{creation.name}</Text> : null}
        {recipe.trimmed > 0 ? <Text style={styles.meta}>{t('culture.oymo.recipe.trimmedNote', { count: recipe.trimmed })}</Text> : null}
        {reducedMotion ? <Text style={styles.meta}>{t('culture.oymo.recipe.reducedMotionNote')}</Text> : null}

        <View style={[styles.stage, { width: size, height: size }]} accessible accessibilityRole="image" accessibilityLabel={t('culture.oymo.recipe.stepA11y', { current: index + 1, total, label: labelOf(step) })} testID="recipe-stage">
          <OymoArtwork layers={step.state.layers} backgroundColor={step.state.backgroundColor} symmetryMode={step.state.symmetry} size={size} />
        </View>
        <Text style={styles.status} accessibilityLiveRegion="polite" testID="recipe-step">
          {t('culture.oymo.recipe.stepOf', { current: index + 1, total })} · {labelOf(step)}
        </Text>
        {index === total - 1 ? (
          <Text style={styles.meta} testID="recipe-final">
            {t('culture.oymo.recipe.final')}
          </Text>
        ) : null}

        <View style={styles.row}>
          <Button label={t('culture.oymo.recipe.previous')} variant="secondary" disabled={index === 0} onPress={() => go(index - 1)} testID="recipe-previous" />
          {playing ? <Button label={t('culture.oymo.recipe.pause')} onPress={() => setPlaying(false)} testID="recipe-pause" /> : <Button label={t('culture.oymo.recipe.play')} disabled={total <= 1} onPress={() => { userPressedPlay.current = true; if (index >= total - 1) setIndex(0); setPlaying(true); }} testID="recipe-play" />}
          <Button label={t('culture.oymo.recipe.next')} variant="secondary" disabled={index >= total - 1} onPress={() => go(index + 1)} testID="recipe-next" />
        </View>

        <Text style={styles.section} accessibilityRole="header">
          {t('culture.oymo.recipe.scrubber')}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrubber} testID="recipe-scrubber">
          {recipe.steps.map((entry, position) => (
            <AnimatedPressable key={position} style={[styles.chip, position === index && styles.chipOn]} onPress={() => go(position)} accessibilityRole="button" accessibilityState={{ selected: position === index }} accessibilityLabel={t('culture.oymo.recipe.stepA11y', { current: position + 1, total, label: labelOf(entry) })} testID={`recipe-chip-${position}`}>
              <Text style={[styles.chipText, position === index && styles.chipTextOn]} numberOfLines={2}>
                {position + 1}. {labelOf(entry)}
              </Text>
            </AnimatedPressable>
          ))}
        </ScrollView>

        <Button label={t('culture.oymo.recipe.openStage')} onPress={openStage} accessibilityHint={t('culture.oymo.recipe.openStageHint')} testID="recipe-open-stage" />
        <Text style={styles.meta}>{t('culture.oymo.recipe.openStageHint')}</Text>
        <Text style={styles.meta}>{t('culture.oymo.recipe.localNote')}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  section: { ...typography.overline, color: colors.textSecondary },
  body: { ...textStyles.body, color: colors.textPrimary },
  cardTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  meta: { ...textStyles.small, color: colors.textSecondary },
  status: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.primary, textAlign: 'center' },
  stage: { alignSelf: 'center', borderRadius: cardRadii.compact, overflow: 'hidden', borderWidth: 1, borderColor: colors.borderSubtle },
  scrubber: { gap: spacing.xs, paddingVertical: 4 },
  chip: { minHeight: 44, maxWidth: 160, paddingHorizontal: spacing.sm, justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...textStyles.small, color: colors.textPrimary },
  chipTextOn: { color: colors.textOnPrimary, fontWeight: '700' },
});
