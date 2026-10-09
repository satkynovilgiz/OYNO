import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useReducer, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button, IconButton, Toggle } from '@/components/ui';
import { announce } from '@/services/a11y/announce';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { handOffToCreator } from '@/services/culture/oymoHandoff';
import type { SymmetryMode } from '@/services/culture/symmetry';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { cellKey, CHALLENGES, compareToTarget, isSolved, MODES, playgroundReducer, resultOf, startPlayground, toCreatorCopy, type Cell, type Challenge } from './playgroundModel';
import { INK, ResultGrid, SourceGrid } from './PlaygroundGrids';

const FREE_MOTIFS = ['muyuz', 'gul', 'kochkorMuyuz', 'tortKulak', 'bulak', 'jalbyrak'];

/**
 * /culture/oymo/symmetry - Symmetry Playground (rules in playgroundModel).
 * An editable source grid and its result under the Creator's own symmetry
 * modes, guide lines for the real rule, Undo/Reset, three matching
 * challenges, and "Open in Creator" as an unsaved copy. Everything is
 * local; nothing is saved and no saved creation is touched.
 */
export function SymmetryPlaygroundScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { experience } = useAgeExperience();
  const large = experience === 'child';
  const [state, dispatch] = useReducer(playgroundReducer, undefined, () => startPlayground());
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [motif, setMotif] = useState(FREE_MOTIFS[0]);
  const [selected, setSelected] = useState<string | null>(null);
  const [guides, setGuides] = useState(true);
  const { design } = state;
  const motifs = challenge ? challenge.motifs : FREE_MOTIFS;
  const name = (motifId: string) => t(`culture.oymo.motifs.${motifId}`);
  const modeName = (mode: SymmetryMode) => t(`culture.oymo.symmetry.${mode}`);
  // Narrow phones: grids stacked full width; wider: side by side.
  const sideBySide = width >= 700;
  const gridSize = Math.min(sideBySide ? (Math.min(width, 900) - spacing.lg * 3) / 2 : width - spacing.lg * 2, 320);
  const solved = challenge ? isSolved(challenge, design) : false;
  const selectedPiece = design.pieces.find((piece) => piece.id === selected) ?? null;

  const act = (action: Parameters<typeof playgroundReducer>[1]) => dispatch(action);
  const tapCell = (cell: Cell) => {
    const piece = design.pieces.find((entry) => cellKey(entry.cell) === cellKey(cell));
    if (piece) {
      setSelected((current) => (current === piece.id ? null : piece.id));
      return;
    }
    if (selectedPiece) {
      act({ type: 'move', id: selectedPiece.id, cell });
      setSelected(null);
    } else act({ type: 'place', cell, motifId: motif });
  };

  // Entering, switching or leaving a challenge starts a separate history (and fixes the challenge's rule).
  const startChallenge = (next: Challenge | null) => {
    setChallenge(next);
    setSelected(null);
    setMotif(next ? next.motifs[0] : FREE_MOTIFS[0]);
    act({ type: 'begin', challenge: next });
  };

  const openInCreator = () => {
    const copy = toCreatorCopy(design, INK);
    handOffToCreator(copy.state, { symmetry: copy.symmetry, source: 'symmetry' });
    router.push('/culture/oymo/create' as never);
  };

  const radio = <T extends string>(heading: string, options: readonly T[], value: T, label: (option: T) => string, onSelect: (option: T) => void, id: string, disabled = false) => (
    <View style={styles.group}>
      <Text style={styles.section} accessibilityRole="header">
        {heading}
      </Text>
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={heading}>
        {options.map((option) => {
          const on = option === value;
          return (
            <AnimatedPressable key={option} style={[styles.chip, large && styles.chipLarge, on && styles.chipOn, disabled && !on && styles.chipDisabled]} disabled={disabled} onPress={() => onSelect(option)} accessibilityRole="radio" accessibilityState={{ checked: on, disabled }} aria-checked={on} accessibilityLabel={label(option)} testID={`sym-${id}-${option}`}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{label(option)}</Text>
            </AnimatedPressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
          {t('symmetryPlayground.title')}
        </Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>
        <Text style={[styles.body, large && styles.bodyLarge]}>{t('symmetryPlayground.intro')}</Text>

        {challenge ? (
          <View style={styles.challengeBar} testID="sym-challenge-active">
            <Text style={styles.cardTitle}>{t(`symmetryPlayground.challenge.${challenge.id}.title`)}</Text>
            <Text style={styles.body}>{t(`symmetryPlayground.challenge.${challenge.id}.task`)}</Text>
            {challenge.mode ? <Text style={styles.meta}>{t('symmetryPlayground.ruleFixed', { mode: modeName(challenge.mode) })}</Text> : null}
            <Text style={[styles.status, solved && styles.statusSolved]} accessibilityLiveRegion="polite" testID="sym-status">
              {solved ? t('symmetryPlayground.solved') : t('symmetryPlayground.progress', compareToTarget(challenge, design))}
            </Text>
          </View>
        ) : null}

        {radio(t('symmetryPlayground.modeTitle'), MODES, design.mode, modeName, (mode) => act({ type: 'mode', mode }), 'mode', !!state.lockedMode)}
        {radio(t('symmetryPlayground.motifTitle'), motifs, motif, name, setMotif, 'motif')}

        <View style={styles.toggleRow}>
          <Text style={[styles.body, styles.flex]}>{t('symmetryPlayground.showGuides')}</Text>
          <Toggle value={guides} onValueChange={setGuides} accessibilityLabel={t('symmetryPlayground.showGuides')} />
        </View>

        <View style={[styles.grids, sideBySide && styles.gridsRow]}>
          <View style={styles.group}>
            <Text style={styles.section} accessibilityRole="header">
              {t('symmetryPlayground.sourceTitle')}
            </Text>
            <SourceGrid size={gridSize} pieces={design.pieces} selected={selected} name={name} onTapCell={tapCell} onDrop={(piece, cell) => act({ type: 'move', id: piece.id, cell })} />
            <Text style={styles.meta}>{selectedPiece ? t('symmetryPlayground.movingHint', { name: name(selectedPiece.motifId) }) : t('symmetryPlayground.tapHint')}</Text>
            {selectedPiece ? (
              <View style={styles.row}>
                <Button
                  label={t('symmetryPlayground.remove')}
                  variant="secondary"
                  onPress={() => {
                    act({ type: 'remove', id: selectedPiece.id });
                    setSelected(null);
                  }}
                  testID="sym-remove"
                />
                <Button label={t('symmetryPlayground.cancelMove')} variant="text" onPress={() => setSelected(null)} />
              </View>
            ) : null}
          </View>
          <View style={styles.group}>
            <Text style={styles.section} accessibilityRole="header">
              {t('symmetryPlayground.resultTitle', { mode: modeName(design.mode) })}
            </Text>
            <ResultGrid size={gridSize} marks={resultOf(design)} mode={design.mode} guides={guides} name={name} testID="sym-result" />
          </View>
          {challenge ? (
            <View style={styles.group}>
              <Text style={styles.section} accessibilityRole="header">
                {t('symmetryPlayground.targetTitle')}
              </Text>
              <ResultGrid size={gridSize} marks={challenge.target.map((mark) => ({ ...mark, source: true }))} mode={challenge.mode ?? 'none'} guides={guides && !!challenge.mode} name={name} testID="sym-target" />
            </View>
          ) : null}
        </View>

        <View style={styles.row}>
          <Button label={t('symmetryPlayground.undo')} variant="secondary" disabled={state.history.length === 0} onPress={() => act({ type: 'undo' })} testID="sym-undo" />
          <Button label={t('symmetryPlayground.reset')} variant="secondary" onPress={() => { setSelected(null); act({ type: 'reset' }); }} testID="sym-reset" />
        </View>

        {/* Geometry, kept apart from culture. */}
        <View style={styles.card} testID="sym-rule">
          <Text style={styles.label}>{t('symmetryPlayground.mathLabel')}</Text>
          <Text style={[styles.body, large && styles.bodyLarge]}>{t(`symmetryPlayground.rules.${design.mode}`)}</Text>
          <Text style={styles.meta}>{t('symmetryPlayground.orientationNote')}</Text>
        </View>

        <Button label={t('symmetryPlayground.openInCreator')} onPress={openInCreator} disabled={design.pieces.length === 0} accessibilityHint={t('symmetryPlayground.openInCreatorHint')} testID="sym-open-creator" />
        <Text style={styles.meta}>{t('symmetryPlayground.openInCreatorHint')}</Text>

        <Text style={styles.section} accessibilityRole="header">
          {t('symmetryPlayground.challengesTitle')}
        </Text>
        {CHALLENGES.map((entry) => (
          <View key={entry.id} style={[styles.card, challenge?.id === entry.id && styles.cardOn]}>
            <Text style={styles.cardTitle}>{t(`symmetryPlayground.challenge.${entry.id}.title`)}</Text>
            <Text style={styles.meta}>{t(`symmetryPlayground.challenge.${entry.id}.task`)}</Text>
            <Button label={t('symmetryPlayground.tryIt')} variant="secondary" onPress={() => startChallenge(entry)} testID={`sym-challenge-${entry.id}`} />
          </View>
        ))}
        {challenge ? <Button label={t('symmetryPlayground.freePlay')} variant="text" onPress={() => startChallenge(null)} testID="sym-free-play" /> : null}

        <View style={[styles.card, styles.cultureCard]} testID="sym-culture">
          <Text style={styles.label}>{t('symmetryPlayground.cultureLabel')}</Text>
          <Text style={styles.body}>{t('symmetryPlayground.cultureNote')}</Text>
          <Button label={t('symmetryPlayground.readOymo')} variant="text" onPress={() => router.push('/culture/item/oymo-overview' as never)} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  group: { gap: spacing.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  flex: { flex: 1 },
  section: { ...typography.overline, color: colors.textSecondary },
  label: { ...textStyles.overline, color: colors.primary },
  body: { ...textStyles.body, color: colors.textPrimary },
  bodyLarge: { fontSize: 19, lineHeight: 28 },
  meta: { ...textStyles.small, color: colors.textSecondary },
  status: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textSecondary },
  statusSolved: { color: colors.primary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { minHeight: 44, paddingHorizontal: spacing.md, justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.surface },
  chipLarge: { minHeight: 52 },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipDisabled: { opacity: 0.5 },
  chipText: { ...textStyles.bodyMedium, color: colors.textPrimary },
  chipTextOn: { color: colors.textOnPrimary, fontWeight: '700' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  grids: { gap: spacing.md },
  gridsRow: { flexDirection: 'row', flexWrap: 'wrap' },
  card: { gap: spacing.xs, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSubtle },
  cardOn: { borderColor: colors.primary, borderWidth: 2 },
  cultureCard: { borderStyle: 'dashed' },
  cardTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  challengeBar: { gap: 4, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.primary },
});
