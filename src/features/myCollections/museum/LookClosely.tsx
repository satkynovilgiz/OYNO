import { router } from 'expo-router';
import { Check, ImageOff, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, TextInput, View, type ImageSourcePropType } from 'react-native';

import { AnimatedPressable, Button } from '@/components/ui';
import { announce } from '@/services/a11y/announce';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { canPlay, endLookSession, keepLookSession, resumeLookSession, CLUE_MAX, EMPTY_LOOK, LOOK_MAX_CLUES, LOOK_MAX_EXHIBITS, lookReducer, playableLook, removeClue, setClue, START_LOOK, toggleLookExhibit, type LookClosely, type LookSession } from './lookCloselyModel';
import type { Exhibition, ExhibitSlide } from './museumModel';

/**
 * Curator side of "Look Closely": choose up to three of the exhibition's
 * exhibits that can be shown, write up to three short clues and pick each
 * clue's target. Saved with the exhibition (same store, same owner).
 */
export function LookCloselySetup({ exhibition, slides, titleOf, onChange, onPlay }: { exhibition: Exhibition; slides: ExhibitSlide[]; titleOf: (key: string) => string; onChange: (look: LookClosely) => void; onPlay: () => void }) {
  const { t } = useTranslation();
  const look = exhibition.lookClosely ?? EMPTY_LOOK;
  const available = new Set(slides.filter((slide) => slide.kind === 'exhibit').map((slide) => slide.key));
  const nextId = () => ['c1', 'c2', 'c3'].find((id) => !look.clues.some((clue) => clue.id === id)) ?? `c${look.clues.length + 1}`;
  return (
    <View style={styles.card} testID="look-setup">
      <Text style={styles.cardTitle} accessibilityRole="header">
        {t('museum.look.sectionTitle')}
      </Text>
      <Text style={styles.meta}>{t('museum.look.sectionHint')}</Text>
      <Text style={styles.label}>{t('museum.look.pickTitle', { count: look.exhibits.length, max: LOOK_MAX_EXHIBITS })}</Text>
      {exhibition.exhibits.map((key) => {
        const chosen = look.exhibits.includes(key);
        const canShow = available.has(key);
        const full = !chosen && look.exhibits.length >= LOOK_MAX_EXHIBITS;
        const disabled = (!chosen && !canShow) || full;
        return (
          <AnimatedPressable key={key} style={[styles.choice, chosen && styles.choiceOn, disabled && styles.choiceDisabled]} disabled={disabled} onPress={() => onChange(toggleLookExhibit(look, key, canShow))} accessibilityRole="checkbox" accessibilityState={{ checked: chosen, disabled }} aria-checked={chosen} accessibilityLabel={canShow ? titleOf(key) : `${titleOf(key)}, ${t('museum.look.unavailableExhibit')}`} testID={`look-pick-${key}`}>
            {chosen ? <Check size={16} color={colors.primary} strokeWidth={2.5} /> : <View style={styles.box} />}
            <Text style={[styles.body, styles.flex]} numberOfLines={2}>
              {titleOf(key)}
              {canShow ? '' : ` · ${t('museum.look.unavailableExhibit')}`}
            </Text>
          </AnimatedPressable>
        );
      })}

      {look.clues.map((clue, index) => (
        <View key={clue.id} style={styles.clue} testID={`look-clue-${index}`}>
          <Text style={styles.label}>{t('museum.look.clueLabel', { n: index + 1 })}</Text>
          <TextInput
            value={clue.text}
            onChangeText={(text) => onChange(setClue(look, { ...clue, text }))}
            maxLength={CLUE_MAX}
            placeholder={t('museum.look.cluePlaceholder')}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={t('museum.look.clueLabel', { n: index + 1 })}
            style={styles.input}
            multiline
            testID={`look-clue-text-${index}`}
          />
          <Text style={styles.counter}>{t('museum.look.clueLimit', { count: clue.text.length, max: CLUE_MAX })}</Text>
          <Text style={styles.meta}>{t('museum.look.clueTarget')}</Text>
          <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={t('museum.look.clueTarget')}>
            {look.exhibits.map((key) => {
              const on = clue.target === key;
              return (
                <AnimatedPressable key={key} style={[styles.chip, on && styles.chipOn]} onPress={() => onChange(setClue(look, { ...clue, target: key }))} accessibilityRole="radio" accessibilityState={{ checked: on }} aria-checked={on} accessibilityLabel={titleOf(key)} testID={`look-target-${index}-${key}`}>
                  <Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>
                    {titleOf(key)}
                  </Text>
                </AnimatedPressable>
              );
            })}
          </View>
          <Button label={t('museum.look.removeClue')} variant="text" onPress={() => onChange(removeClue(look, clue.id))} testID={`look-clue-remove-${index}`} />
        </View>
      ))}
      {look.exhibits.length > 0 && look.clues.length < LOOK_MAX_CLUES ? <Button label={t('museum.look.addClue')} variant="secondary" onPress={() => onChange(setClue(look, { id: nextId(), target: look.exhibits[0], text: '' }))} testID="look-add-clue" /> : null}
      {canPlay(look) ? <Button label={t('museum.look.play')} onPress={onPlay} testID="look-play" /> : <Text style={styles.meta}>{t('museum.look.needMore')}</Text>}
    </View>
  );
}

/**
 * Visitor side. For each clue: the curator's clue (labelled as theirs), a
 * gallery of the chosen exhibits that can be shown, and after the right
 * answer the target, the clue and its source link. Wrong answers just
 * invite another look. The session lives here only.
 */
export function LookCloselyPlay({ exhibition, slides, owner, collectionId, onEnd }: { exhibition: Exhibition; slides: ExhibitSlide[]; owner: string; collectionId: string; onEnd: () => void }) {
  const { t } = useTranslation();
  const { gallery, clues } = useMemo(() => playableLook(exhibition.lookClosely ?? EMPTY_LOOK, slides), [exhibition.lookClosely, slides]);
  const [session, setSessionState] = useState<LookSession>(() => resumeLookSession(owner, collectionId) ?? START_LOOK);
  const setSession = (next: LookSession) => {
    keepLookSession(owner, collectionId, next);
    setSessionState(next);
  };
  const end = () => {
    endLookSession();
    onEnd();
  };
  const clue = clues[session.index];
  const act = (action: Parameters<typeof lookReducer>[2]) => {
    const next = lookReducer(clues, session, action);
    if (action.type === 'answer' && next !== session) announce(next.found.includes(action.clueId) ? t('museum.look.found') : t('museum.look.tryAgain'));
    setSession(next);
  };

  if (!clue) {
    return (
      <View style={styles.stack} testID="look-done">
        <Text style={styles.heading} accessibilityRole="header">
          {t('museum.look.done')}
        </Text>
        <Text style={styles.body}>{t('museum.look.foundCount', { found: session.found.length, total: clues.length })}</Text>
        <Text style={styles.meta}>{t('museum.look.notLearning')}</Text>
        <Button label={t('museum.look.restart')} variant="secondary" onPress={() => setSession(START_LOOK)} testID="look-restart" />
        <Button label={t('museum.look.back')} onPress={end} testID="look-back" />
      </View>
    );
  }

  const found = session.found.includes(clue.id);
  const tried = session.tried[clue.id] ?? [];
  const target = gallery.find((slide) => slide.key === clue.target) ?? null;
  return (
    <View style={styles.stack} testID="look-play-view">
      <Text style={styles.meta} testID="look-progress">
        {t('museum.look.clueOf', { current: session.index + 1, total: clues.length })}
      </Text>
      <View style={styles.clueBlock}>
        <Text style={styles.label}>{t('museum.look.curatorClue')}</Text>
        <Text style={styles.clueText} testID="look-clue">
          {clue.text}
        </Text>
      </View>

      {!clue.available ? (
        <Text style={styles.body} testID="look-unavailable">
          {t('museum.look.unavailableClue')}
        </Text>
      ) : (
        <>
          <Text style={styles.cardTitle}>{t('museum.look.pickPrompt')}</Text>
          <View style={styles.gallery} accessibilityRole="radiogroup" accessibilityLabel={t('museum.look.pickPrompt')}>
            {gallery.map((slide) => {
              const wrong = tried.includes(slide.key);
              const right = found && slide.key === clue.target;
              return (
                <AnimatedPressable
                  key={slide.key}
                  style={[styles.tile, wrong && styles.tileWrong, right && styles.tileRight]}
                  disabled={found}
                  onPress={() => act({ type: 'answer', clueId: clue.id, key: slide.key })}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: right, disabled: found }}
                  aria-checked={right}
                  accessibilityLabel={t('museum.look.answerA11y', { title: slide.content.title, state: wrong ? t('museum.look.triedSuffix') : '' })}
                  testID={`look-answer-${slide.key}`}
                >
                  {slide.content.thumbnail ? <Image source={slide.content.thumbnail as ImageSourcePropType} style={styles.tileImage} resizeMode="cover" /> : <View style={[styles.tileImage, styles.noImage]}><ImageOff size={18} color={colors.textMuted} /></View>}
                  <View style={styles.tileRow}>
                    {wrong ? <X size={14} color={colors.textSecondary} /> : right ? <Check size={14} color={colors.primary} strokeWidth={2.5} /> : null}
                    <Text style={styles.tileTitle} numberOfLines={2}>
                      {slide.content.title}
                    </Text>
                  </View>
                </AnimatedPressable>
              );
            })}
          </View>
          {!found && tried.length > 0 ? (
            <View accessibilityLiveRegion="polite" testID="look-try-again">
              <Text style={styles.body}>{t('museum.look.tryAgain')}</Text>
              <Text style={styles.meta}>{t('museum.look.noPenalty')}</Text>
            </View>
          ) : null}
          {found && target ? (
            <View style={styles.reveal} testID="look-reveal">
              <Text style={styles.heading}>{t('museum.look.found')}</Text>
              <Text style={styles.body}>{t('museum.look.targetIs', { title: target.content.title })}</Text>
              <Text style={styles.meta}>
                {t('museum.look.curatorClue')}: {clue.text}
              </Text>
              {target.content.route ? <Button label={t('museum.look.openSource', { title: target.content.title })} variant="secondary" onPress={() => router.push(target.content.route as never)} testID="look-open-source" /> : null}
            </View>
          ) : null}
        </>
      )}

      <View style={styles.row}>
        {session.index > 0 ? <Button label={t('museum.look.previousClue')} variant="secondary" onPress={() => act({ type: 'previous' })} testID="look-previous" /> : null}
        <Button label={t('museum.look.nextClue')} onPress={() => act({ type: 'next' })} testID="look-next" />
      </View>
      <Text style={styles.meta}>{t('museum.look.notLearning')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  flex: { flex: 1 },
  card: { gap: spacing.xs, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle, marginTop: spacing.sm },
  cardTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  heading: { ...typography.h2, color: colors.textPrimary },
  label: { ...textStyles.overline, color: colors.primary },
  body: { ...textStyles.body, color: colors.textPrimary },
  meta: { ...textStyles.small, color: colors.textSecondary },
  counter: { ...textStyles.small, color: colors.textSecondary, alignSelf: 'flex-end' },
  choice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48, paddingHorizontal: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.borderSubtle },
  choiceOn: { borderColor: colors.primary },
  choiceDisabled: { opacity: 0.55 },
  box: { width: 16, height: 16, borderRadius: 4, borderWidth: 1.5, borderColor: colors.textSecondary },
  clue: { gap: 4, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surface },
  input: { ...textStyles.body, color: colors.textPrimary, minHeight: 64, padding: spacing.sm, textAlignVertical: 'top', borderRadius: cardRadii.compact, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.background },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { minHeight: 44, maxWidth: '100%', paddingHorizontal: spacing.md, justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.background },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...textStyles.bodyMedium, color: colors.textPrimary },
  chipTextOn: { color: colors.textOnPrimary, fontWeight: '700' },
  clueBlock: { gap: 2, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceAlt, borderLeftWidth: 3, borderLeftColor: colors.primary },
  clueText: { ...textStyles.body, fontSize: 18, lineHeight: 26, color: colors.textPrimary },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { width: '47%', minWidth: 130, flexGrow: 1, gap: 4, padding: 6, borderRadius: cardRadii.compact, borderWidth: 2, borderColor: colors.borderSubtle, backgroundColor: colors.surface },
  tileWrong: { borderStyle: 'dashed', opacity: 0.7 },
  tileRight: { borderColor: colors.primary },
  tileImage: { width: '100%', aspectRatio: 4 / 3, borderRadius: 8, backgroundColor: colors.surfaceMuted },
  noImage: { alignItems: 'center', justifyContent: 'center' },
  tileRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tileTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary, flex: 1 },
  reveal: { gap: spacing.xs, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.primary },
});
