import { router } from 'expo-router';
import { ChevronLeft, Smartphone } from 'lucide-react-native';
import { useReducer, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconButton, TextField } from '@/components/ui';
import { announce } from '@/services/a11y/announce';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { handOffToCreator } from '@/services/culture/oymoHandoff';
import { spacing } from '@/theme';

import { cellKey, toCreatorCopy, type Cell } from './playgroundModel';
import { INK, ResultGrid, SourceGrid } from './PlaygroundGrids';
import { VIEW_TIMES, type RememberAction } from './rememberModel';
import { ChoiceGroup, RebuildView, ReferenceView, rememberStyles as styles, useViewCountdown } from './RememberViews';
import { displayName, MAX_PIECES, MIN_PIECES, other, rebuildMotifs, START_TOGETHER, TOGETHER_MOTIFS, togetherReducer, type Role } from './togetherModel';

/**
 * /culture/oymo/remember-together - Remember the Pattern for two players
 * on one device (togetherModel.ts). A makes a pattern, a privacy screen
 * asks to pass the device (nothing of the pattern on it), B taps Ready,
 * looks, hides, rebuilds; then swap roles. Names optional; nothing is
 * stored or scored; works offline.
 */
export function RememberTogetherScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { experience } = useAgeExperience();
  const large = experience === 'child';
  const [state, dispatch] = useReducer(togetherReducer, START_TOGETHER);
  const [motif, setMotif] = useState<string>(TOGETHER_MOTIFS[0]);
  const [selected, setSelected] = useState<string | null>(null);
  const size = Math.min(width - spacing.lg * 2, 320);
  const name = (id: string) => t(`culture.oymo.motifs.${id}`);
  const who = (role: Role) => displayName(state.players, role, (fallback) => t(`rememberTogether.player.${fallback}`));
  const attempt = state.phase === 'attempt' ? state.attempt : null;
  const left = useViewCountdown(attempt?.phase === 'viewing', attempt?.viewTime ?? null, attempt?.views ?? 0, () => dispatch({ type: 'play', action: { type: 'hide' } }));
  const reset = () => {
    setSelected(null);
    setMotif(TOGETHER_MOTIFS[0]);
  };

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
      <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
        {t('rememberTogether.title')}
      </Text>
    </View>
  );

  let body: React.ReactNode = null;
  if (state.phase === 'setup') {
    body = (
      <View style={styles.stack} testID="together-setup">
        <Text style={[styles.body, large && styles.bodyLarge]}>{t('rememberTogether.intro', { min: MIN_PIECES, max: MAX_PIECES })}</Text>
        <Text style={styles.note}>{t('rememberTogether.practiceNote')}</Text>
        <TextField testID="together-name-a" label={t('rememberTogether.nameLabel', { player: t('rememberTogether.player.a') })} value={state.players.a} onChangeText={(value) => dispatch({ type: 'name', role: 'a', name: value })} placeholder={t('rememberTogether.player.a')} />
        <TextField testID="together-name-b" label={t('rememberTogether.nameLabel', { player: t('rememberTogether.player.b') })} value={state.players.b} onChangeText={(value) => dispatch({ type: 'name', role: 'b', name: value })} placeholder={t('rememberTogether.player.b')} />
        <Text style={styles.meta}>{t('rememberTogether.namesNote')}</Text>
        <ChoiceGroup heading={t('rememberPattern.viewTitle')} options={VIEW_TIMES} value={state.viewTime} label={(option) => (option === null ? t('rememberPattern.untimed') : t('rememberPattern.seconds', { count: option }))} onSelect={(viewTime) => dispatch({ type: 'viewTime', viewTime })} id="time" large={large} />
        <Button label={t('rememberTogether.start')} size="lg" onPress={() => { reset(); dispatch({ type: 'begin' }); }} testID="together-start" />
      </View>
    );
  } else if (state.phase === 'authoring') {
    const design = state.editor.design;
    const selectedPiece = design.pieces.find((piece) => piece.id === selected) ?? null;
    const author = (action: Parameters<typeof togetherReducer>[1]) => dispatch(action);
    const tapCell = (cell: Cell) => {
      const piece = design.pieces.find((entry) => cellKey(entry.cell) === cellKey(cell));
      if (piece) return setSelected((current) => (current === piece.id ? null : piece.id));
      if (selectedPiece) {
        author({ type: 'author', action: { type: 'move', id: selectedPiece.id, cell } });
        setSelected(null);
      } else author({ type: 'author', action: { type: 'place', cell, motifId: motif } });
    };
    body = (
      <View style={styles.stack} testID="together-authoring">
        <Text style={styles.heading} accessibilityRole="header">
          {t('rememberTogether.makeTitle', { name: who(state.author) })}
        </Text>
        <Text style={styles.meta}>{t('rememberTogether.makeHint', { min: MIN_PIECES, max: MAX_PIECES, other: who(other(state.author)) })}</Text>
        <ChoiceGroup heading={t('rememberPattern.motifTitle')} options={[...TOGETHER_MOTIFS]} value={motif} label={name} onSelect={setMotif} id="motif" large={large} />
        <SourceGrid size={size} pieces={design.pieces} selected={selected} name={name} onTapCell={tapCell} onDrop={(piece, cell) => author({ type: 'author', action: { type: 'move', id: piece.id, cell } })} />
        <Text style={styles.status} accessibilityLiveRegion="polite" testID="together-count">
          {t('rememberTogether.pieces', { count: design.pieces.length, max: MAX_PIECES })}
        </Text>
        {state.problems.length ? (
          <View style={styles.feedback} accessibilityLiveRegion="polite" testID="together-problems">
            {state.problems.map((problem) => (
              <Text key={problem} style={styles.body}>
                {t(`rememberTogether.problems.${problem}`, { min: MIN_PIECES, max: MAX_PIECES })}
              </Text>
            ))}
          </View>
        ) : null}
        <View style={styles.row}>
          <Button label={t('rememberPattern.undo')} variant="secondary" disabled={state.editor.history.length === 0} onPress={() => author({ type: 'author', action: { type: 'undo' } })} testID="together-undo" />
          {selectedPiece ? <Button label={t('rememberPattern.remove')} variant="secondary" onPress={() => { author({ type: 'author', action: { type: 'remove', id: selectedPiece.id } }); setSelected(null); }} testID="together-remove" /> : null}
        </View>
        <Button label={t('rememberTogether.doneMaking')} size="lg" onPress={() => { setSelected(null); dispatch({ type: 'pass' }); announce(t('rememberTogether.passTitle', { name: who(other(state.author)) })); }} testID="together-pass" />
      </View>
    );
  } else if (state.phase === 'pass') {
    // Privacy screen: nothing about the pattern is rendered here.
    const player = who(other(state.author));
    body = (
      <View style={[styles.stack, { alignItems: 'center' }]} testID="together-pass-screen">
        <Smartphone size={40} color={styles.status.color} strokeWidth={1.75} />
        <Text style={[styles.heading, { textAlign: 'center' }]} accessibilityRole="header">
          {t('rememberTogether.passTitle', { name: player })}
        </Text>
        <Text style={[styles.body, { textAlign: 'center' }]}>{t('rememberTogether.passBody', { name: player, author: who(state.author) })}</Text>
        <Button label={t('rememberTogether.ready', { name: player })} size="lg" onPress={() => { reset(); dispatch({ type: 'ready' }); }} testID="together-ready" />
      </View>
    );
  } else {
    const play = (action: RememberAction) => dispatch({ type: 'play', action });
    const player = who(other(state.author));
    const design = state.attempt.editor.design;
    if (state.attempt.phase === 'viewing') body = <ReferenceView pattern={state.reference} size={size} left={left} name={name} onHide={() => play({ type: 'hide' })} title={t('rememberTogether.lookTitle', { name: player, author: who(state.author) })} />;
    else if (state.attempt.phase === 'building') body = <RebuildView state={state.attempt} size={size} motifs={rebuildMotifs()} motif={motif} onMotif={setMotif} selected={selected} onSelect={setSelected} large={large} name={name} onAction={play} title={t('rememberTogether.buildTitle', { name: player })} />;
    else
      body = (
        <View style={styles.stack} testID="together-done">
          <Text style={styles.heading} accessibilityRole="header">
            {t('rememberTogether.doneTitle', { name: player, author: who(state.author) })}
          </Text>
          <ResultGrid size={size} marks={design.pieces.map((piece) => ({ cell: piece.cell, motifId: piece.motifId, source: true }))} mode="none" guides={false} name={name} testID="together-result" />
          <Text style={styles.body}>{t('rememberPattern.doneChecks', { count: state.attempt.checks })}</Text>
          <Text style={styles.bodyBold} testID="together-assisted">
            {state.attempt.assisted ? t('rememberPattern.assisted') : t('rememberPattern.unassisted')}
          </Text>
          <Text style={styles.note}>{t('rememberTogether.practiceNote')}</Text>
          <Button label={t('rememberTogether.swap', { name: player })} size="lg" onPress={() => { reset(); dispatch({ type: 'swap' }); }} testID="together-swap" />
          <Button
            label={t('rememberPattern.openInCreator')}
            variant="secondary"
            accessibilityHint={t('rememberPattern.openInCreatorHint')}
            onPress={() => {
              const copy = toCreatorCopy(design, INK);
              handOffToCreator(copy.state, { symmetry: 'none', source: 'remember' });
              router.push('/culture/oymo/create' as never);
            }}
            testID="together-open-creator"
          />
          <Button label={t('rememberTogether.retry')} variant="secondary" onPress={() => dispatch({ type: 'retry' })} testID="together-retry" />
          <Button label={t('rememberTogether.newGame')} variant="text" onPress={() => dispatch({ type: 'newGame' })} testID="together-new-game" />
        </View>
      );
  }

  return (
    <View style={styles.root}>
      {header}
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} keyboardShouldPersistTaps="handled">
        {body}
      </ScrollView>
    </View>
  );
}
