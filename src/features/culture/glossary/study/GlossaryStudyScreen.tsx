import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Animated, ScrollView, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KyrgyzOnlyNote } from '@/components/content/KyrgyzOnlyNote';
import { SourcesAndNotes } from '@/components/content/SourcesAndNotes';
import { OfflineUnavailable } from '@/components/offline/OfflineUnavailable';
import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { Button, IconButton, MediaImage } from '@/components/ui';
import { cultureItemImages } from '@/features/culture/data';
import { useRecordsOwner } from '@/features/games/records/useGameRecords';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { track } from '@/services/analytics/analytics';
import { useReducedMotion } from '@/services/motion/useReducedMotion';
import { ownerStudy, useGlossaryStudyStore } from '@/store/useGlossaryStudyStore';
import { colors, editorial, radii, spacing, textStyles, typography } from '@/theme';

import { useGlossary } from '../useGlossary';
import { buildSession, sessionSummary, type SessionMode, type StudyAction } from './glossaryStudy';

/**
 * /culture/glossary/study - flashcards over the EXISTING glossary: the
 * Kyrgyz term on the front, the authored definition, source and its
 * unchanged verification on the back. "Review again" / "Got it" only - no
 * score, no rewards, nothing outside this feature changes.
 */
export function GlossaryStudyScreen({
  mode,
  onPressBack,
  limit,
  only,
  onDone,
}: {
  mode: SessionMode;
  onPressBack: () => void;
  /** Study Queue "Quick review": only the first `limit` cards of the session. */
  limit?: number;
  /** Focus Session: only these entries (still in the session's own order). */
  only?: readonly string[];
  /** Replaces the result actions (e.g. "Back to Study Queue"). */
  onDone?: { label: string; run: () => void };
}) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const isChild = experience === 'child';
  const isAdult = experience === 'adult';
  const reducedMotion = useReducedMotion();
  const owner = useRecordsOwner();
  const { entries, isLoading, waitingForNetwork, retry } = useGlossary();
  const studyLoaded = useGlossaryStudyStore((state) => state.isLoaded);
  const [seed] = useState(() => Date.now() % 2147483647);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [answers, setAnswers] = useState<StudyAction[]>([]);
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    void useGlossaryStudyStore.getState().load();
  }, []);

  // The session is fixed once glossary + study state are known.
  const validIds = useMemo(() => entries.map(({ entry }) => entry.id), [entries]);
  const [sessionCards, setCards] = useState<string[] | null>(null);
  // An entry that becomes invalid mid-session is simply skipped.
  const cards = sessionCards ? sessionCards.filter((id) => validIds.includes(id)) : null;
  useEffect(() => {
    if (sessionCards || !studyLoaded || isLoading || validIds.length === 0) return;
    // Stale records (removed/invalid entries) never become cards.
    useGlossaryStudyStore.getState().prune(owner, validIds);
    const session = buildSession(validIds, ownerStudy(useGlossaryStudyStore.getState().saved, owner), mode, seed)
      .filter((id) => !only || only.includes(id))
      .slice(0, limit ?? Number.MAX_SAFE_INTEGER);
    setCards(session);
    track('glossary_study_started', { mode, cards: session.length });
  }, [sessionCards, studyLoaded, isLoading, validIds, owner, mode, seed, limit, only]);

  if (waitingForNetwork) return <OfflineUnavailable onRetry={retry} />;

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
      <Text style={styles.kicker}>{t('glossaryStudy.title')}</Text>
      {cards && cards.length > 0 && index < cards.length ? <Text style={styles.counter}>{index + 1} / {cards.length}</Text> : null}
    </View>
  );

  if (!cards) {
    return (
      <View style={styles.root}>
        {header}
        <View style={styles.center}>{isLoading || !studyLoaded ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.empty}>{t('glossary.noResults')}</Text>}</View>
      </View>
    );
  }

  // Session result: plain counts only.
  if (index >= cards.length) {
    const summary = sessionSummary(answers);
    const waiting = cards.length === 0;
    return (
      <View style={styles.root}>
        {header}
        <View style={[styles.center, { padding: spacing.lg, gap: spacing.md }]}>
          <OymoOrnament size={28} color={colors.accentGold} strokeWidth={1.5} />
          <Text style={styles.resultTitle} accessibilityRole="header">
            {waiting ? t('glossaryStudy.nothingWaiting') : t('glossaryStudy.reviewed', { count: summary.reviewed })}
          </Text>
          {!waiting ? (
            <Text style={styles.resultMeta}>
              {t('glossaryStudy.gotIt')}: {summary.gotIt} · {t('glossaryStudy.reviewAgain')}: {summary.reviewAgain}
            </Text>
          ) : null}
          {onDone ? (
            <Button label={onDone.label} onPress={onDone.run} />
          ) : (
            <>
              {summary.reviewAgain > 0 ? <Button label={t('glossaryStudy.reviewTerms')} onPress={() => router.replace('/culture/glossary/study?mode=review' as never)} /> : null}
              <Button label={t('glossaryStudy.backToGlossary')} variant="secondary" onPress={() => router.replace('/culture/glossary' as never)} />
            </>
          )}
        </View>
      </View>
    );
  }

  const resolved = entries.find(({ entry }) => entry.id === cards[index])!;
  const { entry, item, definition, alternateNames } = resolved;
  const image: ImageSourcePropType | null = item.image_url ? { uri: item.image_url } : (cultureItemImages[item.id]?.[0] ?? null);

  const swap = (change: () => void) => {
    // Reduce Motion: an instant swap; otherwise a short fade.
    if (reducedMotion) {
      change();
      return;
    }
    Animated.timing(fade, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
      change();
      Animated.timing(fade, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    });
  };

  const answer = (action: StudyAction) => {
    useGlossaryStudyStore.getState().answer(owner, entry.id, action);
    track('glossary_card_reviewed', { glossary_entry_id: entry.id, action });
    const nextAnswers = [...answers, action];
    swap(() => {
      setAnswers(nextAnswers);
      setRevealed(false);
      setIndex(index + 1);
      if (index + 1 >= cards.length) {
        track('glossary_study_completed', { cards: cards.length });
        useGlossaryStudyStore.getState().completeSession(owner);
      }
    });
  };

  return (
    <View style={styles.root}>
      {header}
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        <Animated.View style={[styles.card, isAdult && styles.cardEditorial, { opacity: fade }]}>
          {!revealed ? (
            <View style={styles.front} accessible accessibilityLabel={`${entry.term}. ${t('glossaryStudy.front')}.`}>
              <View style={[styles.image, isChild && styles.imageChild]}>{image ? <MediaImage source={image} /> : <OymoOrnament size={56} color="rgba(232,185,61,0.5)" strokeWidth={1.25} />}</View>
              <Text style={[styles.term, isChild && styles.termChild, isAdult && styles.termEditorial]}>{entry.term}</Text>
            </View>
          ) : (
            <View style={styles.back} accessibilityLiveRegion="polite">
              <Text style={[styles.termSmall, isAdult && styles.termEditorial]} accessibilityLabel={`${entry.term}. ${t('glossaryStudy.meaningShown')}.`}>
                {entry.term}
              </Text>
              {alternateNames.length > 0 && !isChild ? <Text style={styles.alt}>{t('glossary.alsoKnownAs', { names: alternateNames.join(', ') })}</Text> : null}
              <KyrgyzOnlyNote status={item.translation?.status} language={i18n.language} />
              <Text style={styles.label}>{t('glossaryStudy.meaning')}</Text>
              <Text style={styles.definition} numberOfLines={isChild ? 5 : undefined}>
                {definition}
              </Text>
              {!isChild ? (
                <>
                  <Text style={styles.label}>{t('glossaryStudy.source')}</Text>
                  <Text style={styles.source}>{item.title}</Text>
                </>
              ) : null}
              {/* The source's own verification, unchanged by the card format. */}
              <SourcesAndNotes contentType="culture_item" level={item.accuracy_level} sources={item.sources} />
            </View>
          )}
        </Animated.View>

        {!revealed ? (
          <Button label={t('glossaryStudy.showMeaning')} size={isChild ? 'lg' : 'md'} onPress={() => swap(() => setRevealed(true))} />
        ) : (
          <View style={styles.actions}>
            <View style={{ flex: 1 }}>
              <Button label={t('glossaryStudy.reviewAgain')} variant="secondary" onPress={() => answer('review_again')} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label={t('glossaryStudy.gotIt')} onPress={() => answer('got_it')} />
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  kicker: { ...typography.overline, color: colors.accentTerracotta, flex: 1 },
  counter: { ...textStyles.small, color: colors.textSecondary, fontVariant: ['tabular-nums'] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { ...textStyles.body, color: colors.textSecondary },
  content: { paddingHorizontal: spacing.md, gap: spacing.md },
  card: { padding: spacing.lg, borderRadius: radii.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder, minHeight: 320 },
  cardEditorial: { borderLeftWidth: 3, borderLeftColor: colors.accentGold },
  front: { alignItems: 'center', gap: spacing.md },
  image: { width: '100%', aspectRatio: 1.6, borderRadius: radii.lg, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceFeature },
  imageChild: { aspectRatio: 1.2 },
  term: { ...textStyles.display, color: colors.textPrimary, textAlign: 'center' },
  termChild: { fontSize: 44, lineHeight: 50 },
  termEditorial: { ...editorial(textStyles.display) },
  back: { gap: spacing.xs },
  termSmall: { ...textStyles.h2, color: colors.textPrimary },
  alt: { ...textStyles.small, fontStyle: 'italic', color: colors.textSecondary },
  label: { ...typography.overline, color: colors.accentTerracotta, marginTop: spacing.xs },
  definition: { ...textStyles.body, fontSize: 17, lineHeight: 26, color: colors.textPrimary },
  source: { ...textStyles.bodyMedium, color: colors.textPrimary },
  actions: { flexDirection: 'row', gap: spacing.sm },
  resultTitle: { ...textStyles.h2, color: colors.textPrimary, textAlign: 'center' },
  resultMeta: { ...textStyles.body, color: colors.textSecondary, textAlign: 'center' },
});
