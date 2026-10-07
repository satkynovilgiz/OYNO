import { router } from 'expo-router';
import { Check, ChevronLeft, ChevronRight, MapPinned, X } from 'lucide-react-native';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button, IconButton } from '@/components/ui';
import { useRecordsOwner } from '@/features/games/records/useGameRecords';
import { announce } from '@/services/a11y/announce';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { useTrackScreenView } from '@/services/analytics/useTrackScreenView';
import { ownerMapChallenge, useMapChallengeStore } from '@/store/useMapChallengeStore';
import { cardRadii, colors, editorial, spacing, textStyles, typography } from '@/theme';

import { ILLUSTRATED_MAP_ASPECT, ILLUSTRATED_MAP_IMAGE } from '../map/illustratedMap';
import { LABEL_MASKS, MAP_QUESTIONS, markersFor, targetRoute, type MapQuestion } from './mapChallengeData';
import { buildMapSession, mapFinished, mapReducer, mapSummary, markerAt, markerSizes, startMapSession, toPercent, type MapAction, type MapSession } from './mapChallengeModel';

const MARKER_SIZE = 30;
/** The touch area around each marker (>= 44 pt). */
const MARKER_HIT = 44;

/**
 * /explore/map-challenge - find regions and places on the illustrated map.
 * Offline (bundled art, anchors and facts), no timer, and playing is never
 * a visit: visits, the Discovery Passport and region progress don't change.
 */
export function MapChallengeScreen({ onPressBack }: { onPressBack: () => void }) {
  useTrackScreenView('map_challenge');
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const large = experience === 'child';
  const owner = useRecordsOwner();
  const record = useMapChallengeStore((state) => ownerMapChallenge(state.saved, owner));
  const [phase, setPhase] = useState<'intro' | 'playing' | 'results'>('intro');
  const [session, dispatch] = useReducer((state: MapSession, action: MapAction | { type: 'start'; questions: MapQuestion[] }) => (action.type === 'start' ? startMapSession(action.questions) : mapReducer(state, action)), startMapSession([]));
  const recorded = useRef(false);
  const name = (id: string) => t(`mapChallenge.names.${id}`);

  useEffect(() => {
    void useMapChallengeStore.getState().load();
  }, []);

  const begin = (onlyIds?: string[]) => {
    recorded.current = false;
    dispatch({ type: 'start', questions: buildMapSession(undefined, onlyIds ? { onlyIds } : {}) });
    setPhase('playing');
  };

  const finished = phase === 'playing' && mapFinished(session);
  const summary = useMemo(() => mapSummary(session), [session]);
  useEffect(() => {
    if (!finished || recorded.current) return;
    recorded.current = true;
    useMapChallengeStore.getState().recordSession(owner, { correct: summary.correct, missedIds: summary.mistakes.map((mistake) => mistake.questionId) });
    setPhase('results');
    announce(t('mapChallenge.score', { correct: summary.correct, total: summary.total }));
  }, [finished]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <Text style={[styles.title, experience === 'adult' && styles.titleEditorial]} accessibilityRole="header" numberOfLines={1}>
          {t('mapChallenge.title')}
        </Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        {phase === 'intro' ? (
          <View style={styles.stack} testID="map-challenge-intro">
            <MapPinned size={28} color={colors.primary} strokeWidth={2} />
            <Text style={[styles.body, large && styles.bodyLarge]}>{t('mapChallenge.intro')}</Text>
            <Text style={styles.meta}>{t('mapChallenge.notVisiting')}</Text>
            {record.sessions > 0 ? <Text style={styles.meta}>{t('mapChallenge.best', { correct: record.best })}</Text> : null}
            <Button label={t('mapChallenge.start')} size="lg" onPress={() => begin()} testID="map-challenge-start" />
            {record.lastMissedIds.length > 0 ? <Button label={t('mapChallenge.practiseMissed')} variant="secondary" onPress={() => begin(record.lastMissedIds)} testID="map-challenge-practise" /> : null}
          </View>
        ) : null}

        {phase === 'playing' && !finished && session.questions[session.index] ? <QuestionView key={session.index} session={session} large={large} name={name} onChoose={(markerId) => dispatch({ type: 'choose', markerId })} onNext={() => dispatch({ type: 'next' })} /> : null}

        {phase === 'results' ? (
          <View style={styles.stack} testID="map-challenge-results">
            <Text style={styles.heading} accessibilityRole="header">
              {t('mapChallenge.resultsTitle')}
            </Text>
            <Text style={[styles.body, styles.bold]} testID="map-challenge-score">
              {t('mapChallenge.score', { correct: summary.correct, total: summary.total })}
            </Text>
            <Text style={styles.meta}>{t('mapChallenge.notVisiting')}</Text>
            <Text style={styles.cardTitle}>{t('mapChallenge.mistakesTitle')}</Text>
            {summary.mistakes.length === 0 ? <Text style={styles.body}>{t('mapChallenge.noMistakes')}</Text> : null}
            {summary.mistakes.map((mistake) => {
              const question = MAP_QUESTIONS.find((item) => item.id === mistake.questionId)!;
              return (
                <AnimatedPressable key={mistake.questionId} style={styles.row} onPress={() => router.push(targetRoute(question) as never)} accessibilityRole="link" accessibilityLabel={`${t('mapChallenge.mistake', { name: name(question.targetId), chosen: name(mistake.chosenId) })}. ${t('mapChallenge.openRegion', { name: name(question.targetId) })}`} testID={`map-challenge-mistake-${mistake.questionId}`}>
                  <Text style={[styles.body, { flex: 1 }]}>{t('mapChallenge.mistake', { name: name(question.targetId), chosen: name(mistake.chosenId) })}</Text>
                  <ChevronRight size={16} color={colors.textMuted} strokeWidth={2} />
                </AnimatedPressable>
              );
            })}
            <Button label={t('mapChallenge.replay')} size="lg" onPress={() => begin()} testID="map-challenge-replay" />
            {summary.mistakes.length > 0 ? <Button label={t('mapChallenge.practiseMissed')} variant="secondary" onPress={() => begin(summary.mistakes.map((mistake) => mistake.questionId))} testID="map-challenge-practise" /> : null}
            <Button label={t('mapChallenge.back')} variant="text" onPress={onPressBack} />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function QuestionView({ session, large, name, onChoose, onNext }: { session: MapSession; large: boolean; name: (id: string) => string; onChoose: (markerId: string) => void; onNext: () => void }) {
  const { t } = useTranslation();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const question = session.questions[session.index];
  const markers = markersFor(question.layer);
  const answer = session.showingAnswer ? session.answers[session.answers.length - 1] : null;
  const last = session.index === session.questions.length - 1;
  // Alphabetical in the current language: list order says nothing about the map.
  const listed = [...markers].sort((a, b) => name(a.id).localeCompare(name(b.id)));
  // Sized from the real distance between markers on THIS screen (no overlapping touch boxes).
  const sizes = markerSizes(markers, size.width || 300, ILLUSTRATED_MAP_ASPECT);
  const prompt = question.layer === 'regions' ? t('mapChallenge.findRegion', { name: name(question.targetId) }) : t('mapChallenge.findPlace', { name: name(question.targetId) });

  useEffect(() => {
    if (answer) announce(answer.correct ? t('mapChallenge.correct', { name: name(question.targetId) }) : t('mapChallenge.wrong', { chosen: name(answer.chosenId), name: name(question.targetId) }));
  }, [answer]); // eslint-disable-line react-hooks/exhaustive-deps

  // A tap anywhere on the map picks the nearest marker (same rule on every screen size).
  const onTapMap = (event: GestureResponderEvent) => {
    if (answer || size.width === 0) return;
    const hit = markerAt(toPercent(event.nativeEvent.locationX, event.nativeEvent.locationY, size.width, size.height), markers, ILLUSTRATED_MAP_ASPECT);
    if (hit) onChoose(hit.id);
  };

  return (
    <View style={styles.stack} testID="map-challenge-question">
      <Text style={styles.meta}>{t('mapChallenge.questionOf', { current: session.index + 1, total: session.questions.length })}</Text>
      <Text style={[styles.heading, large && styles.headingLarge]} accessibilityRole="header" testID="map-challenge-prompt">
        {prompt}
      </Text>
      <View style={styles.mapFrame} onLayout={(event) => setSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })} testID="map-challenge-map">
        <Pressable onPress={onTapMap} disabled={!!answer} accessible={false} style={StyleSheet.absoluteFill}>
          {/* Explicit size: the whole painting, exactly the frame (no crop on any width). */}
          {size.width > 0 ? <Image source={ILLUSTRATED_MAP_IMAGE} style={{ width: size.width, height: size.height }} resizeMode="stretch" accessibilityLabel={t('mapChallenge.mapA11y')} /> : null}
        </Pressable>
        {/* Painted names would give the answer away: covered until it's answered. */}
        {!answer
          ? LABEL_MASKS.map((mask, index) => <View key={index} pointerEvents="none" style={[styles.mask, { left: `${mask.left}%`, top: `${mask.top}%`, width: `${mask.width}%`, height: `${mask.height}%` }]} testID="map-challenge-mask" />)
          : null}
        {markers.map((marker, index) => {
          const isTarget = answer && marker.id === question.targetId;
          const isWrongChoice = answer && !answer.correct && marker.id === answer.chosenId;
          return (
            <Pressable
              key={marker.id}
              onPress={() => onChoose(marker.id)}
              disabled={!!answer}
              style={[styles.markerHit, { left: `${marker.at.xPercent}%`, top: `${marker.at.yPercent}%`, width: sizes.hit, height: sizes.hit, marginLeft: -sizes.hit / 2, marginTop: -sizes.hit / 2 }]}
              accessibilityRole="button"
              // During a question a marker has a NUMBER, never a name.
              accessibilityLabel={answer ? t('mapChallenge.markerNamedA11y', { name: name(marker.id) }) : t('mapChallenge.markerA11y', { number: index + 1 })}
              testID={`map-challenge-marker-${marker.id}`}
            >
              <View style={[styles.marker, { width: sizes.dot, height: sizes.dot, borderRadius: sizes.dot / 2 }, isTarget && styles.markerTarget, isWrongChoice && styles.markerWrong]}>
                {isTarget ? <Check size={16} color={colors.textOnPrimary} strokeWidth={3} /> : isWrongChoice ? <X size={16} color={colors.textOnPrimary} strokeWidth={3} /> : <Text style={styles.markerNumber}>{index + 1}</Text>}
              </View>
              {isTarget ? (
                <Text style={[styles.markerLabel, { top: sizes.hit - 2 }]} numberOfLines={1} testID="map-challenge-answer-label">
                  {name(marker.id)}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {!answer ? (
        <View style={styles.stack}>
          <Text style={styles.cardTitle}>{t('mapChallenge.listTitle')}</Text>
          <View style={styles.list} accessibilityRole="radiogroup">
            {listed.map((marker) => (
              <AnimatedPressable key={marker.id} style={[styles.option, large && styles.optionLarge]} onPress={() => onChoose(marker.id)} accessibilityRole="radio" accessibilityState={{ checked: false }} aria-checked={false} accessibilityLabel={name(marker.id)} testID={`map-challenge-option-${marker.id}`}>
                <Text style={[styles.optionText, large && styles.bodyLarge]}>{name(marker.id)}</Text>
              </AnimatedPressable>
            ))}
          </View>
        </View>
      ) : (
        <View style={styles.card} testID="map-challenge-feedback">
          <Text style={styles.cardTitle}>{answer.correct ? t('mapChallenge.correct', { name: name(question.targetId) }) : t('mapChallenge.wrong', { chosen: name(answer.chosenId), name: name(question.targetId) })}</Text>
          <Text style={styles.meta}>{t('mapChallenge.factsTitle', { name: name(question.targetId) })}</Text>
          {question.factIndexes.map((index) => (
            <Text key={index} style={[styles.body, large && styles.bodyLarge]}>
              • {t(`mapChallenge.facts.${question.id}.fact${index}`)}
            </Text>
          ))}
          <AnimatedPressable style={styles.link} onPress={() => router.push(targetRoute(question) as never)} accessibilityRole="link" accessibilityLabel={t('mapChallenge.openRegion', { name: name(question.targetId) })} testID="map-challenge-open">
            <Text style={styles.linkText}>{t('mapChallenge.openRegion', { name: name(question.targetId) })}</Text>
            <ChevronRight size={16} color={colors.primary} strokeWidth={2} />
          </AnimatedPressable>
          <Button label={last ? t('mapChallenge.seeResults') : t('mapChallenge.next')} onPress={onNext} testID="map-challenge-next" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  titleEditorial: { ...editorial(typography.h1) },
  content: { paddingHorizontal: spacing.md, gap: spacing.md },
  stack: { gap: spacing.sm },
  heading: { ...typography.h2, color: colors.textPrimary },
  headingLarge: { fontSize: 24, lineHeight: 32 },
  body: { ...textStyles.body, color: colors.textPrimary },
  bodyLarge: { fontSize: 19, lineHeight: 27 },
  bold: { fontWeight: '700' },
  meta: { ...textStyles.small, color: colors.textSecondary },
  mapFrame: { width: '100%', aspectRatio: ILLUSTRATED_MAP_ASPECT, borderRadius: cardRadii.media, overflow: 'hidden', backgroundColor: colors.surfaceMuted },
  mask: { position: 'absolute', borderRadius: 6, backgroundColor: 'rgba(233, 214, 170, 0.96)' },
  markerHit: { position: 'absolute', width: MARKER_HIT, height: MARKER_HIT, marginLeft: -MARKER_HIT / 2, marginTop: -MARKER_HIT / 2, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  marker: { width: MARKER_SIZE, height: MARKER_SIZE, borderRadius: MARKER_SIZE / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.primary },
  markerTarget: { backgroundColor: colors.primary, borderColor: colors.surface },
  markerWrong: { backgroundColor: colors.accentTerracotta, borderColor: colors.surface },
  markerNumber: { ...textStyles.small, fontWeight: '700', color: colors.primary },
  markerLabel: { position: 'absolute', top: MARKER_HIT - 4, ...textStyles.small, fontWeight: '700', color: colors.textPrimary, backgroundColor: colors.surface, paddingHorizontal: 6, borderRadius: 6, overflow: 'hidden' },
  list: { gap: spacing.xs },
  option: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1.5, borderColor: colors.borderSubtle },
  optionLarge: { minHeight: 60 },
  optionText: { ...textStyles.bodyMedium, fontWeight: '600', color: colors.textPrimary },
  card: { gap: spacing.xs, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  cardTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, alignSelf: 'flex-start' },
  linkText: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.primary },
});
