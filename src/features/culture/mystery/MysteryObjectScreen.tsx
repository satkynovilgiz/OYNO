import { router } from 'expo-router';
import { ChevronLeft, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button, IconButton } from '@/components/ui';
import { sectionLabelKey } from '@/features/culture/itemSections';
import { useRecordsOwner } from '@/features/games/records/useGameRecords';
import { announce } from '@/services/a11y/announce';
import { useAllCultureItems } from '@/services/content/cultureItemsService';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { attemptReducer, availableMysteries, clueSources, explanationSource, keepAttempt, MAX_CLUES, MYSTERIES, pickMystery, resumeAttempt, startAttempt, type Attempt, type AttemptAction } from './mysteryModel';

/**
 * /culture/mystery - Mystery Object (mysteryModel.ts). Read a clue, reveal
 * more if you like, pick one of four real articles; wrong guesses don't end
 * the round. Then the answer, its source text (labelled as the article's)
 * and the article itself. Untimed, no score. The attempt survives opening
 * the article (memory, per owner). Uses the cached article list offline.
 */
export function MysteryObjectScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const owner = useRecordsOwner();
  const items = useAllCultureItems();
  const ids = useMemo(() => new Set((items.data ?? []).map((item) => item.id)), [items.data]);
  const pool = useMemo(() => (items.data ? availableMysteries((id) => ids.has(id)) : []), [items.data, ids]);
  const [attempt, setAttemptState] = useState<Attempt | null>(() => resumeAttempt(owner));
  const setAttempt = (next: Attempt | null) => {
    keepAttempt(owner, next);
    setAttemptState(next);
  };
  useEffect(() => setAttemptState(resumeAttempt(owner)), [owner]);

  const mystery = attempt ? (MYSTERIES.find((entry) => entry.id === attempt.mysteryId) ?? null) : null;
  // The round's articles were removed meanwhile: never an impossible round - offer another.
  const stillPlayable = !!mystery && (!items.data || pool.some((entry) => entry.id === mystery.id));
  const name = (articleId: string) => t(`detective.names.${articleId}`);
  const sectionOf = (field: string) => {
    const key = sectionLabelKey(field);
    return key ? t(key) : field;
  };
  const begin = () => {
    const next = pickMystery(pool, attempt?.mysteryId ?? null);
    setAttempt(next ? startAttempt(next) : null);
  };
  const act = (action: AttemptAction) => {
    if (!attempt || !mystery) return;
    const next = attemptReducer(attempt, action, mystery);
    if (next === attempt) return;
    setAttempt(next);
    if (action.type === 'guess') announce(next.outcome === 'found' ? t('mysteryObject.found', { name: name(mystery.sourceId) }) : t('mysteryObject.notThis', { name: name(action.optionId) }));
    if (action.type === 'reveal') announce(t('mysteryObject.clueN', { n: next.revealed }));
  };

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
      <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
        {t('mysteryObject.title')}
      </Text>
    </View>
  );

  let body: React.ReactNode;
  if (!items.data) body = <Text style={styles.meta}>{items.isError ? t('mysteryObject.offlineNone') : t('mysteryObject.loading')}</Text>;
  else if (!attempt || !mystery || !stillPlayable) {
    body = (
      <View style={styles.stack} testID="mystery-start">
        {attempt && !stillPlayable ? <Text style={styles.warn} testID="mystery-removed">{t('mysteryObject.removed')}</Text> : null}
        <Text style={styles.body}>{t('mysteryObject.intro')}</Text>
        <Text style={styles.note}>{t('mysteryObject.untimed')}</Text>
        {pool.length ? <Button label={t('mysteryObject.start')} size="lg" onPress={begin} testID="mystery-begin" /> : <Text style={styles.body} testID="mystery-none">{t('mysteryObject.none')}</Text>}
      </View>
    );
  } else {
    const sources = clueSources(mystery);
    const done = attempt.outcome !== 'playing';
    body = (
      <View style={styles.stack} testID="mystery-play">
        <Text style={styles.meta}>{t('mysteryObject.howTo')}</Text>
        {sources.slice(0, attempt.revealed).map((source, index) => (
          <View key={source.textKey} style={styles.clue} testID={`mystery-clue-${index + 1}`}>
            <Text style={styles.label}>{t('mysteryObject.clueN', { n: index + 1 })}</Text>
            <Text style={styles.body}>{t(source.textKey)}</Text>
            {/* The source section during play (the article's name would give the answer away); full source after. */}
            <Text style={styles.meta}>{done ? t('mysteryObject.fromArticle', { article: name(source.articleId), section: sectionOf(source.field) }) : t('mysteryObject.fromSection', { section: sectionOf(source.field) })}</Text>
          </View>
        ))}
        {!done ? (
          attempt.revealed < MAX_CLUES ? <Button label={t('mysteryObject.reveal')} variant="secondary" onPress={() => act({ type: 'reveal' })} testID="mystery-reveal" /> : <Text style={styles.meta}>{t('mysteryObject.allClues')}</Text>
        ) : null}

        <Text style={styles.section} accessibilityRole="header">
          {t('mysteryObject.whichOne')}
        </Text>
        {attempt.options.map((optionId) => {
          const wrong = attempt.wrong.includes(optionId);
          const isAnswer = done && optionId === mystery.sourceId;
          return (
            <AnimatedPressable key={optionId} style={[styles.option, wrong && styles.optionWrong, isAnswer && styles.optionRight]} disabled={done || wrong} onPress={() => act({ type: 'guess', optionId })} accessibilityRole="button" accessibilityState={{ disabled: done || wrong }} accessibilityLabel={wrong ? `${name(optionId)}, ${t('mysteryObject.notThisShort')}` : name(optionId)} testID={`mystery-option-${optionId}`}>
              {wrong ? <X size={16} color={colors.accentTerracottaText} strokeWidth={2.5} /> : null}
              <Text style={styles.optionText}>{name(optionId)}</Text>
              {wrong ? <Text style={styles.meta}>{t('mysteryObject.notThisShort')}</Text> : null}
            </AnimatedPressable>
          );
        })}
        {!done && attempt.wrong.length > 0 ? (
          <Text style={styles.body} accessibilityLiveRegion="polite" testID="mystery-try-again">
            {t('mysteryObject.tryAgain')}
          </Text>
        ) : null}
        {!done ? <Button label={t('mysteryObject.showAnswer')} variant="text" onPress={() => act({ type: 'showAnswer' })} testID="mystery-show-answer" /> : null}

        {done ? (
          <View style={styles.stack} testID="mystery-answer">
            <Text style={styles.heading} accessibilityRole="header">
              {attempt.outcome === 'found' ? t('mysteryObject.found', { name: name(mystery.sourceId) }) : t('mysteryObject.itWas', { name: name(mystery.sourceId) })}
            </Text>
            {/* The article's own words, apart from the game's instructions. */}
            <View style={styles.source} testID="mystery-evidence">
              <Text style={styles.label}>{t('mysteryObject.fromArticle', { article: name(mystery.sourceId), section: sectionOf(explanationSource(mystery).field) })}</Text>
              <Text style={styles.body}>{t(explanationSource(mystery).textKey)}</Text>
            </View>
            <Text style={styles.meta}>{t('mysteryObject.gameNote', { clues: attempt.revealed, guesses: attempt.wrong.length + (attempt.outcome === 'found' ? 1 : 0) })}</Text>
            <Button label={t('mysteryObject.readArticle')} onPress={() => router.push(`/culture/item/${mystery.sourceId}` as never)} testID="mystery-source" />
            <Button label={t('mysteryObject.another')} variant="secondary" onPress={begin} disabled={pool.length === 0} testID="mystery-another" />
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {header}
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>{body}</ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  stack: { gap: spacing.sm },
  section: { ...typography.overline, color: colors.textSecondary, marginTop: spacing.sm },
  heading: { ...typography.h2, color: colors.textPrimary },
  label: { ...textStyles.overline, color: colors.primary },
  body: { ...textStyles.body, color: colors.textPrimary },
  meta: { ...textStyles.small, color: colors.textSecondary },
  warn: { ...textStyles.small, fontWeight: '700', color: colors.accentTerracottaText },
  note: { ...textStyles.small, color: colors.textPrimary, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceMuted },
  clue: { gap: 4, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 52, paddingHorizontal: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1.5, borderColor: colors.borderSubtle },
  optionWrong: { borderStyle: 'dashed', backgroundColor: colors.surface },
  optionRight: { borderColor: colors.primary, borderWidth: 2.5 },
  optionText: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary, flex: 1 },
  source: { gap: 4, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceAlt, borderLeftWidth: 3, borderLeftColor: colors.primary },
});
