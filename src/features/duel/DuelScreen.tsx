import { router } from 'expo-router';
import { Check, ChevronLeft, ChevronRight, Lightbulb, Smartphone, Swords, X } from 'lucide-react-native';
import { useEffect, useReducer, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button, ConfirmationModal, IconButton, TextField } from '@/components/ui';
import { detectiveQuestion, questionArtwork, sourceRoute } from '@/features/detective/detectiveQuestions';
import { useLeaveGuard } from '@/hooks/useLeaveGuard';
import { announce } from '@/services/a11y/announce';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { useTrackScreenView } from '@/services/analytics/useTrackScreenView';
import { cardRadii, colors, editorial, spacing, textStyles, typography } from '@/theme';

import { duelReducer, MAX_NAME_LENGTH, PLAYER_COUNTS, rematch, startDuel, visible, type DuelAction, type DuelState, type MatchLength, type PlayerCount, type PlayerIndex } from './duelModel';

type Setup = { players: PlayerCount; names: string[]; rounds: MatchLength };
type ScreenState = { kind: 'setup' } | { kind: 'match'; duel: DuelState };
type ScreenAction = { type: 'start'; setup: Setup } | { type: 'rematch' } | { type: 'setup' } | DuelAction;

function screenReducer(state: ScreenState, action: ScreenAction): ScreenState {
  if (action.type === 'start') return { kind: 'match', duel: startDuel({ names: action.setup.names.slice(0, action.setup.players), rounds: action.setup.rounds }) };
  if (action.type === 'setup') return { kind: 'setup' };
  if (state.kind !== 'match') return state;
  if (action.type === 'rematch') return { kind: 'match', duel: rematch(state.duel) };
  return { kind: 'match', duel: duelReducer(state.duel, action) };
}

/**
 * /culture/duel - local two-player Culture Duel on one phone. Nicknames and
 * results live only in this screen's state: not stored, not in analytics,
 * not learning progress, not official game records.
 */
export function DuelScreen({ onPressBack }: { onPressBack: () => void }) {
  useTrackScreenView('culture_duel'); // the screen name only - never the nicknames
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const large = experience === 'child';
  const [state, dispatch] = useReducer(screenReducer, { kind: 'setup' });
  const [setup, setSetup] = useState<Setup>({ players: 2, names: ['', '', '', ''], rounds: 3 });
  /** Set while "Leave the duel?" is open: what leaving does (a held navigation, or plain back). */
  const [leaving, setLeaving] = useState<{ proceed: () => void } | null>(null);

  const inMatch = state.kind === 'match' && state.duel.phase.kind !== 'final';
  const nameOf = (player: PlayerIndex) => (state.kind === 'match' && state.duel.names[player]) || t('duel.nameLabel', { number: player + 1 });

  // Leaving the phone (app to background) mid-turn hides the question again:
  // the next person to pick it up sees only "Pass the phone".
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') dispatch({ type: 'conceal' });
    });
    return () => subscription.remove();
  }, []);

  // Leaving an unfinished match asks first - header Back, Android back,
  // browser Back and any other navigation that would remove this screen
  // (the iOS swipe-back is off while a match runs). The match isn't saved.
  const guard = useLeaveGuard({
    active: inMatch,
    onBlocked: (proceed) => setLeaving({ proceed }),
    onHardwareBack: () => {
      if (leaving) return true;
      if (!inMatch) return false;
      setLeaving({ proceed: onPressBack });
      return true;
    },
  });

  const view = state.kind === 'match' ? visible(state.duel) : null;
  useEffect(() => {
    if (view?.kind === 'handoff') announce(t('duel.passTo', { name: nameOf(view.player) }));
    if (view?.kind === 'reveal') announce(t('duel.revealTitle'));
    if (view?.kind === 'final') announce(view.outcome.kind === 'tie' ? t('duel.tie') : t('duel.winner', { name: nameOf(view.outcome.winner) }));
  }, [view?.kind, state.kind === 'match' ? state.duel.phase : null]); // eslint-disable-line react-hooks/exhaustive-deps

  const optionName = (id: string) => t(`detective.names.${id}`);
  const total = state.kind === 'match' ? state.duel.questions.length : setup.rounds;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={() => (inMatch ? setLeaving({ proceed: onPressBack }) : onPressBack())} />
        <Text style={[styles.title, experience === 'adult' && styles.titleEditorial]} accessibilityRole="header" numberOfLines={1}>
          {t('duel.title')}
        </Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]} keyboardShouldPersistTaps="handled">
        {state.kind === 'setup' ? (
          <View style={styles.stack} testID="duel-setup">
            <Swords size={28} color={colors.primary} strokeWidth={2} />
            <Text style={[styles.body, large && styles.bodyLarge]}>{t('duel.intro')}</Text>
            <View style={styles.card} testID="duel-rules">
              <Text style={[styles.body, large && styles.bodyLarge]}>{t('duel.rules')}</Text>
            </View>
            <Text style={styles.heading}>{t('duel.playersTitle')}</Text>
            <View style={styles.choices} accessibilityRole="radiogroup">
              {PLAYER_COUNTS.map((players) => {
                const selected = setup.players === players;
                const label = players === 2 ? t('duel.twoPlayers') : t('duel.partyPlayers', { count: players });
                return (
                  <AnimatedPressable key={players} style={[styles.choice, large && styles.choiceLarge, selected && styles.choiceOn]} onPress={() => setSetup((current) => ({ ...current, players }))} accessibilityRole="radio" accessibilityState={{ checked: selected }} aria-checked={selected} accessibilityLabel={label} testID={`duel-players-${players}`}>
                    {selected ? <Check size={16} color={colors.primary} strokeWidth={2.5} /> : null}
                    <Text style={[styles.optionText, large && styles.bodyLarge]}>{label}</Text>
                  </AnimatedPressable>
                );
              })}
            </View>
            <Text style={styles.heading}>{t('duel.namesTitle')}</Text>
            {Array.from({ length: setup.players }, (_, player) => (
              <TextField
                key={player}
                testID={`duel-name-${player + 1}`}
                label={t('duel.nameLabel', { number: player + 1 })}
                value={setup.names[player]}
                onChangeText={(value) => setSetup((current) => ({ ...current, names: current.names.map((name, index) => (index === player ? value.slice(0, MAX_NAME_LENGTH) : name)) }))}
                placeholder={t('duel.nameLabel', { number: player + 1 })}
                autoCapitalize="words"
              />
            ))}
            <Text style={styles.meta}>{t('duel.namesNote')}</Text>
            <Text style={styles.heading}>{t('duel.lengthTitle')}</Text>
            <View style={styles.choices} accessibilityRole="radiogroup">
              {([3, 5] as const).map((rounds) => {
                const selected = setup.rounds === rounds;
                return (
                  <AnimatedPressable
                    key={rounds}
                    style={[styles.choice, large && styles.choiceLarge, selected && styles.choiceOn]}
                    onPress={() => setSetup((current) => ({ ...current, rounds }))}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    aria-checked={selected}
                    accessibilityLabel={t(rounds === 3 ? 'duel.short' : 'duel.long')}
                    testID={`duel-length-${rounds}`}
                  >
                    {selected ? <Check size={16} color={colors.primary} strokeWidth={2.5} /> : null}
                    <Text style={[styles.optionText, large && styles.bodyLarge]}>{t(rounds === 3 ? 'duel.short' : 'duel.long')}</Text>
                  </AnimatedPressable>
                );
              })}
            </View>
            <Button label={t('duel.start')} size="lg" onPress={() => dispatch({ type: 'start', setup })} testID="duel-start" />
            <Text style={styles.meta}>{t('duel.separateNote')}</Text>
          </View>
        ) : null}

        {view?.kind === 'handoff' ? (
          // Nothing about the round's answers is on this screen.
          <View style={[styles.stack, styles.center]} testID="duel-handoff">
            <Text style={styles.meta}>{t('duel.roundOf', { current: view.round + 1, total })}</Text>
            <Smartphone size={44} color={colors.primary} strokeWidth={1.75} />
            <Text style={[styles.heading, styles.centerText, large && styles.headingLarge]} accessibilityRole="header">
              {t('duel.passTo', { name: nameOf(view.player) })}
            </Text>
            <Text style={[styles.body, styles.centerText]}>{t('duel.onlyYou', { name: nameOf(view.player) })}</Text>
            <ReadyButton key={`${view.round}-${view.player}`} label={t('duel.ready', { name: nameOf(view.player) })} onPress={() => dispatch({ type: 'ready' })} />
          </View>
        ) : null}

        {view?.kind === 'answering' ? <TurnView key={`${view.round}-${view.player}`} name={nameOf(view.player)} round={view.round} total={total} questionId={view.question.questionId} options={view.question.options} large={large} optionName={optionName} onAnswer={(optionId) => dispatch({ type: 'answer', optionId })} /> : null}

        {view?.kind === 'reveal' ? (
          <RevealView
            view={view}
            total={total}
            names={state.kind === 'match' ? state.duel.names.map((_, player) => nameOf(player)) : []}
            large={large}
            optionName={optionName}
            onNext={() => dispatch({ type: 'next' })}
          />
        ) : null}

        {view?.kind === 'final' ? (
          <View style={styles.stack} testID="duel-final">
            <Text style={styles.heading} accessibilityRole="header">
              {t('duel.finalTitle')}
            </Text>
            <Text style={[styles.winner, large && styles.headingLarge]} testID="duel-outcome">
              {view.outcome.kind === 'win' ? t('duel.winner', { name: nameOf(view.outcome.winner) }) : view.outcome.leaders.length === (state.kind === 'match' ? state.duel.names.length : 2) ? t('duel.tie') : t('duel.sharedFirst', { names: view.outcome.leaders.map(nameOf).join(', ') })}
            </Text>
            {state.kind === 'match' && state.duel.names.length === 2 ? (
              <Text style={[styles.body, styles.bold]} testID="duel-final-score">
                {t('duel.scoreLine', { first: nameOf(0), a: view.outcome.scores[0], b: view.outcome.scores[1], second: nameOf(1) })}
              </Text>
            ) : (
              <View style={styles.card} testID="duel-ranking">
                {view.outcome.ranking.map((entry) => (
                  <View key={entry.player} style={styles.rankRow} accessible accessibilityLabel={t('duel.rankA11y', { position: entry.position, name: nameOf(entry.player), count: entry.score })} testID={`duel-rank-${entry.player + 1}`}>
                    <Text style={[styles.rankPosition, large && styles.bodyLarge]}>{entry.position}.</Text>
                    <Text style={[styles.body, large && styles.bodyLarge, { flex: 1 }]}>{nameOf(entry.player)}</Text>
                    <Text style={[styles.body, styles.bold]}>{t('duel.points', { count: entry.score })}</Text>
                  </View>
                ))}
              </View>
            )}
            <Button label={t('duel.rematch')} size="lg" onPress={() => dispatch({ type: 'rematch' })} testID="duel-rematch" />
            <Button label={t('duel.newPlayers')} variant="secondary" onPress={() => dispatch({ type: 'setup' })} testID="duel-new-players" />
            <Button label={t('duel.back')} variant="text" onPress={onPressBack} />
          </View>
        ) : null}
      </ScrollView>

      <ConfirmationModal
        visible={!!leaving}
        title={t('duel.leaveTitle')}
        message={t('duel.leaveBody')}
        confirmLabel={t('duel.leave')}
        cancelLabel={t('duel.stay')}
        destructive
        onConfirm={() => {
          const pending = leaving;
          setLeaving(null);
          guard.allowLeave();
          pending?.proceed();
        }}
        onCancel={() => setLeaving(null)}
      />
    </View>
  );
}

/** A press this soon after a handoff appears is the previous player's double tap - ignored. */
export const HANDOFF_ARM_MS = 700;

/** "I'm <name> - show my question": inactive for a moment so a double tap on an answer can't open the NEXT player's turn. */
function ReadyButton({ label, onPress }: { label: string; onPress: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setArmed(true), HANDOFF_ARM_MS);
    return () => clearTimeout(timer);
  }, []);
  // Looks normal (no dimmed flash); presses in the first moment are simply ignored.
  return (
    <View testID={armed ? 'duel-ready-armed' : undefined}>
      <Button label={label} size="lg" block onPress={() => armed && onPress()} testID="duel-ready" />
    </View>
  );
}

/** One player's turn: the picture, the shared clue and four answers. No feedback after answering - the turn simply passes. */
function TurnView({ name, round, total, questionId, options, large, optionName, onAnswer }: { name: string; round: number; total: number; questionId: string; options: string[]; large: boolean; optionName: (id: string) => string; onAnswer: (optionId: string) => void }) {
  const { t } = useTranslation();
  const question = detectiveQuestion(questionId)!;
  const artwork = questionArtwork(question);
  return (
    <View style={styles.stack} testID="duel-turn">
      <Text style={styles.meta}>
        {t('duel.turnOf', { name })} · {t('duel.roundOf', { current: round + 1, total })}
      </Text>
      {artwork ? (
        <Image source={artwork} style={[styles.artwork, large && styles.artworkLarge]} resizeMode="cover" accessibilityLabel={t('duel.artworkA11y')} />
      ) : (
        <View style={styles.noImage}>
          <Text style={styles.meta}>{t('duel.noImage')}</Text>
        </View>
      )}
      <View style={styles.clue}>
        <Lightbulb size={16} color={colors.accentTerracotta} strokeWidth={2} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.clueLabel}>{t('duel.clue')}</Text>
          <Text style={[styles.body, large && styles.bodyLarge]}>{t(`detective.questions.${question.id}.clue1`)}</Text>
        </View>
      </View>
      <Text style={styles.heading}>{t('duel.question')}</Text>
      <View style={styles.options} accessibilityRole="radiogroup">
        {options.map((optionId) => (
          <AnimatedPressable key={optionId} style={[styles.option, large && styles.choiceLarge]} onPress={() => onAnswer(optionId)} accessibilityRole="radio" accessibilityState={{ checked: false }} aria-checked={false} accessibilityLabel={t('duel.optionA11y', { name: optionName(optionId) })} testID={`duel-option-${optionId}`}>
            <Text style={[styles.optionText, large && styles.bodyLarge]}>{optionName(optionId)}</Text>
          </AnimatedPressable>
        ))}
      </View>
    </View>
  );
}

function RevealView({ view, total, names, large, optionName, onNext }: { view: Extract<ReturnType<typeof visible>, { kind: 'reveal' }>; total: number; names: string[]; large: boolean; optionName: (id: string) => string; onNext: () => void }) {
  const { t } = useTranslation();
  const question = detectiveQuestion(view.question.questionId)!;
  const last = view.round + 1 >= total;
  return (
    <View style={styles.stack} testID="duel-reveal">
      <Text style={styles.meta}>{t('duel.roundOf', { current: view.round + 1, total })}</Text>
      <Text style={styles.heading} accessibilityRole="header">
        {t('duel.revealTitle')}
      </Text>
      <Text style={[styles.body, styles.bold]} testID="duel-correct">
        {t('duel.itWas', { name: optionName(view.question.sourceId) })}
      </Text>
      {names.map((_, player) => (
        <View key={player} style={[styles.answerRow, view.correct[player] ? styles.answerRight : styles.answerWrong]} testID={`duel-answer-${player + 1}`} accessible accessibilityLabel={`${t('duel.answerOf', { name: names[player], answer: optionName(view.chosen[player]) })}, ${view.correct[player] ? t('duel.correctMark') : t('duel.wrongMark')}`}>
          {view.correct[player] ? <Check size={18} color={colors.primary} strokeWidth={2.5} /> : <X size={18} color={colors.accentTerracotta} strokeWidth={2.5} />}
          <Text style={[styles.body, large && styles.bodyLarge, { flex: 1 }]}>{t('duel.answerOf', { name: names[player], answer: optionName(view.chosen[player]) })}</Text>
        </View>
      ))}
      <Text style={[styles.body, large && styles.bodyLarge]}>{t(`detective.questions.${question.id}.explanation`)}</Text>
      <AnimatedPressable style={styles.link} onPress={() => router.push(sourceRoute(question) as never)} accessibilityRole="link" accessibilityLabel={`${t('duel.readArticle')}: ${optionName(view.question.sourceId)}`}>
        <Text style={styles.linkText}>{t('duel.readArticle')}</Text>
        <ChevronRight size={16} color={colors.primary} strokeWidth={2} />
      </AnimatedPressable>
      <Text style={styles.meta} testID="duel-score">
        {names.length === 2 ? t('duel.scoreLine', { first: names[0], a: view.scores[0], b: view.scores[1], second: names[1] }) : names.map((name, player) => `${name} ${view.scores[player]}`).join(' · ')}
      </Text>
      <Button label={last ? t('duel.seeFinal') : t('duel.nextRound')} onPress={onNext} testID="duel-next" />
    </View>
  );
}

/** Culture entry row. */
export function DuelEntryRow() {
  const { t } = useTranslation();
  return (
    <AnimatedPressable style={styles.entryRow} onPress={() => router.push('/culture/duel' as never)} press="soft" accessibilityRole="button" accessibilityLabel={`${t('duel.title')}. ${t('duel.entryMeta')}`} testID="duel-entry">
      <Swords size={18} color={colors.primary} strokeWidth={2} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.cardTitle}>{t('duel.title')}</Text>
        <Text style={styles.meta}>{t('duel.entryMeta')}</Text>
      </View>
      <ChevronRight size={16} color={colors.textMuted} strokeWidth={2} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  titleEditorial: { ...editorial(typography.h1) },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  stack: { gap: spacing.sm },
  center: { alignItems: 'center', paddingTop: spacing.xl },
  centerText: { textAlign: 'center' },
  heading: { ...typography.h2, color: colors.textPrimary },
  headingLarge: { fontSize: 26, lineHeight: 34 },
  winner: { ...typography.h1, color: colors.primary },
  body: { ...textStyles.body, color: colors.textPrimary },
  bodyLarge: { fontSize: 19, lineHeight: 27 },
  bold: { fontWeight: '700' },
  meta: { ...textStyles.small, color: colors.textSecondary },
  card: { gap: spacing.xs, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  cardTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  choices: { gap: spacing.xs },
  choice: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 52, paddingHorizontal: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1.5, borderColor: colors.borderSubtle },
  choiceLarge: { minHeight: 64 },
  choiceOn: { borderColor: colors.primary },
  artwork: { width: '100%', aspectRatio: 4 / 3, borderRadius: cardRadii.media, backgroundColor: colors.surfaceMuted },
  artworkLarge: { aspectRatio: 1 },
  noImage: { width: '100%', aspectRatio: 4 / 3, borderRadius: cardRadii.media, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  clue: { flexDirection: 'row', gap: spacing.xs, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceAlt },
  clueLabel: { ...textStyles.overline, color: colors.primary },
  options: { gap: spacing.xs },
  option: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1.5, borderColor: colors.borderSubtle },
  optionText: { ...textStyles.bodyMedium, fontWeight: '600', color: colors.textPrimary, flexShrink: 1 },
  answerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1.5 },
  answerRight: { borderColor: colors.primary },
  answerWrong: { borderColor: colors.accentTerracotta },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44, flexWrap: 'wrap' },
  rankPosition: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.primary, minWidth: 28 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, alignSelf: 'flex-start' },
  linkText: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.primary },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, minHeight: 56, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
});
