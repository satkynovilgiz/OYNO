import { router } from 'expo-router';
import { ChevronLeft, Smartphone, Trash2 } from 'lucide-react-native';
import { useReducer, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button, IconButton, TextField } from '@/components/ui';
import { useAuthStore } from '@/store/useAuthStore';
import { announce } from '@/services/a11y/announce';
import { handOffToCreator } from '@/services/culture/oymoHandoff';
import { MAX_OYMO_LAYERS, removeLayer } from '@/services/culture/oymoEditor';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { CANVAS_SIZE, OymoCanvas } from '../components/OymoCanvas';
import { ColorSwatches } from '../components/ColorSwatches';
import { MotifGrid } from '../components/MotifGrid';
import { OymoArtwork } from '../components/OymoArtwork';
import { SymmetryControl } from '../components/SymmetryControl';
import { OYMO_MOTIFS, type OymoMotifId } from '../motifs';
import { atLimit, finalDesign, NAME_MAX, placeMotif, START, TURN_CHOICES, togetherReducer, type Player } from './togetherCreateModel';

/**
 * /culture/oymo/together - Create Together (togetherCreateModel.ts): two
 * people take explicit turns on one shared design with the Creator's own
 * motifs, editor and canvas. Untimed, no scores. Nothing is saved here; the
 * result opens in the Creator as an unsaved copy (save it there, with the
 * account that is signed in).
 */
export function CreateTogetherScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const signedIn = useAuthStore((state) => state.status === 'authenticated');
  const [state, dispatch] = useReducer(togetherReducer, START);
  const [motif, setMotif] = useState<OymoMotifId>(OYMO_MOTIFS[0].id);
  const [color, setColor] = useState<string>(colors.primary);
  const [designName, setDesignName] = useState('');
  const who = (player: Player) => (state.names[player].trim() || t(`createTogether.player.${player}`));
  const motifName = (id: string) => t(`culture.oymo.motifs.${id}`);
  const preview = Math.min(width - spacing.lg * 2, 300);

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
      <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
        {t('createTogether.title')}
      </Text>
    </View>
  );

  let body: React.ReactNode = null;
  if (state.phase === 'setup') {
    body = (
      <View style={styles.stack} testID="together-create-setup">
        <Text style={styles.body}>{t('createTogether.intro')}</Text>
        <Text style={styles.note}>{t('createTogether.noScores')}</Text>
        <TextField testID="together-create-name-a" label={t('createTogether.nameLabel', { player: t('createTogether.player.a') })} value={state.names.a} onChangeText={(name) => dispatch({ type: 'name', player: 'a', name })} placeholder={t('createTogether.player.a')} />
        <TextField testID="together-create-name-b" label={t('createTogether.nameLabel', { player: t('createTogether.player.b') })} value={state.names.b} onChangeText={(name) => dispatch({ type: 'name', player: 'b', name })} placeholder={t('createTogether.player.b')} />
        <Text style={styles.meta}>{t('createTogether.namesNote', { max: NAME_MAX })}</Text>
        <Text style={styles.section}>{t('createTogether.turnsTitle')}</Text>
        <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel={t('createTogether.turnsTitle')}>
          {TURN_CHOICES.map((choice) => {
            const on = state.turnLimit === choice;
            return (
              <AnimatedPressable key={String(choice)} style={[styles.chip, on && styles.chipOn]} onPress={() => dispatch({ type: 'turnLimit', turnLimit: choice })} accessibilityRole="radio" accessibilityState={{ checked: on }} aria-checked={on} testID={`together-create-turns-${choice ?? 'free'}`}>
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{choice === null ? t('createTogether.free') : t('createTogether.turns', { count: choice })}</Text>
              </AnimatedPressable>
            );
          })}
        </View>
        <Button label={t('createTogether.start')} size="lg" onPress={() => dispatch({ type: 'begin' })} testID="together-create-start" />
      </View>
    );
  } else if (state.phase === 'turn') {
    const design = state.design;
    body = (
      <View style={styles.stack} testID="together-create-turn">
        <Text style={styles.heading} accessibilityRole="header" accessibilityLiveRegion="polite" testID="together-create-whose">
          {state.turnLimit === null ? t('createTogether.whoseTurnFree', { name: who(state.player), turn: state.turn }) : t('createTogether.whoseTurn', { name: who(state.player), turn: state.turn, total: state.turnLimit })}
        </Text>
        <View style={styles.canvas}>
          <OymoCanvas layers={design.layers} backgroundColor={design.backgroundColor} symmetryMode={state.symmetry} selectedLayerId={null} onTapCanvas={(point) => dispatch({ type: 'edit', change: placeMotif(point, motif, color) })} onSelectLayer={() => undefined} />
        </View>
        <View style={styles.wrap}>
          <Button label={t('culture.oymo.placeAtCenter')} variant="secondary" size="sm" disabled={atLimit(design)} onPress={() => dispatch({ type: 'edit', change: placeMotif({ x: CANVAS_SIZE / 2, y: CANVAS_SIZE / 2 }, motif, color) })} testID="together-create-place" />
          <Button label={t('createTogether.undo')} variant="secondary" size="sm" disabled={state.history.length === 0} onPress={() => dispatch({ type: 'undo' })} accessibilityHint={t('createTogether.undoHint')} testID="together-create-undo" />
        </View>
        <Text style={styles.meta} testID="together-create-count">
          {t('createTogether.layers', { count: design.layers.length, max: MAX_OYMO_LAYERS })}
        </Text>
        {atLimit(design) ? <Text style={styles.warn}>{t('createTogether.limit', { max: MAX_OYMO_LAYERS })}</Text> : null}
        <Text style={styles.section}>{t('culture.oymo.motifSection')}</Text>
        <MotifGrid selectedMotifId={motif} onSelectMotif={setMotif} color={color} />
        <Text style={styles.section}>{t('culture.oymo.colorSection')}</Text>
        <ColorSwatches selectedColor={color} onSelectColor={setColor} />
        <Text style={styles.section}>{t('culture.oymo.symmetrySection')}</Text>
        <SymmetryControl mode={state.symmetry} onChangeMode={(symmetry) => dispatch({ type: 'symmetry', symmetry })} />
        {/* The layers as a list: name + remove, for screen readers and precise edits. */}
        <Text style={styles.section}>{t('createTogether.layerList')}</Text>
        {design.layers.length === 0 ? <Text style={styles.meta}>{t('createTogether.noLayers')}</Text> : null}
        {design.layers.map((layer, index) => (
          <View key={layer.id} style={styles.layerRow} testID={`together-create-layer-${index}`}>
            <Text style={[styles.body, styles.flex]}>
              {index + 1}. {motifName(layer.motifId)}
            </Text>
            <IconButton icon={Trash2} size={36} iconSize={14} elevated={false} accessibilityLabel={t('createTogether.removeLayer', { n: index + 1, name: motifName(layer.motifId) })} onPress={() => dispatch({ type: 'edit', change: (current) => removeLayer(current, layer.id) })} testID={`together-create-remove-${index}`} />
          </View>
        ))}
        {state.confirmReset ? (
          <View style={styles.card} testID="together-create-reset-confirm">
            <Text style={styles.body}>{t('createTogether.resetConfirm')}</Text>
            <View style={styles.wrap}>
              <Button label={t('createTogether.resetYes')} variant="danger" size="sm" onPress={() => dispatch({ type: 'confirmReset' })} testID="together-create-reset-yes" />
              <Button label={t('createTogether.resetNo')} variant="text" size="sm" onPress={() => dispatch({ type: 'cancelReset' })} />
            </View>
          </View>
        ) : (
          <Button label={t('createTogether.reset')} variant="text" disabled={design.layers.length === 0} onPress={() => dispatch({ type: 'askReset' })} testID="together-create-reset" />
        )}
        <Button label={t('createTogether.pass', { name: who(state.player === 'a' ? 'b' : 'a') })} size="lg" onPress={() => { dispatch({ type: 'pass' }); announce(t('createTogether.passTitle', { name: who(state.player === 'a' ? 'b' : 'a') })); }} testID="together-create-pass" />
        <Button label={t('createTogether.finishNow')} variant="secondary" onPress={() => dispatch({ type: 'finish' })} testID="together-create-finish" />
      </View>
    );
  } else if (state.phase === 'pass') {
    body = (
      <View style={[styles.stack, { alignItems: 'center' }]} testID="together-create-pass-screen">
        <Smartphone size={40} color={colors.primary} strokeWidth={1.75} />
        <Text style={[styles.heading, { textAlign: 'center' }]} accessibilityRole="header">
          {t('createTogether.passTitle', { name: who(state.next) })}
        </Text>
        <Text style={[styles.body, { textAlign: 'center' }]}>{t('createTogether.passBody')}</Text>
        <Button label={t('createTogether.startTurn', { name: who(state.next) })} size="lg" onPress={() => dispatch({ type: 'startTurn' })} testID="together-create-start-turn" />
        <Button label={t('createTogether.finishNow')} variant="text" onPress={() => dispatch({ type: 'finish' })} />
      </View>
    );
  } else {
    body = (
      <View style={styles.stack} testID="together-create-finish-screen">
        <Text style={styles.heading} accessibilityRole="header">
          {t('createTogether.doneTitle')}
        </Text>
        <View style={[styles.canvas, { width: preview, height: preview }]} accessible accessibilityRole="image" accessibilityLabel={t('createTogether.layers', { count: state.design.layers.length, max: MAX_OYMO_LAYERS })}>
          <OymoArtwork layers={state.design.layers} backgroundColor={state.design.backgroundColor} symmetryMode={state.symmetry} size={preview} />
        </View>
        <Text style={styles.meta}>{t('createTogether.doneMeta', { count: state.turns })}</Text>
        <TextField testID="together-create-design-name" label={t('createTogether.designName')} value={designName} onChangeText={(value) => setDesignName(value.slice(0, 60))} placeholder={t('createTogether.designNamePlaceholder')} />
        <Text style={styles.meta}>{t('createTogether.namesNotIncluded')}</Text>
        <Text style={styles.note}>{signedIn ? t('createTogether.saveSignedIn') : t('createTogether.saveGuest')}</Text>
        <Button
          label={t('createTogether.openCreator')}
          disabled={state.design.layers.length === 0}
          onPress={() => {
            const copy = finalDesign(state);
            handOffToCreator(copy.state, { symmetry: copy.symmetry, source: 'together', name: designName });
            router.push('/culture/oymo/create' as never);
          }}
          testID="together-create-open"
        />
        <Button label={t('createTogether.again')} variant="text" onPress={() => { setDesignName(''); dispatch({ type: 'newSession' }); }} testID="together-create-again" />
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  stack: { gap: spacing.sm },
  flex: { flex: 1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center' },
  section: { ...typography.overline, color: colors.textSecondary, marginTop: spacing.xs },
  heading: { ...typography.h2, color: colors.textPrimary },
  body: { ...textStyles.body, color: colors.textPrimary },
  meta: { ...textStyles.small, color: colors.textSecondary },
  warn: { ...textStyles.small, fontWeight: '700', color: colors.accentTerracottaText },
  note: { ...textStyles.small, color: colors.textPrimary, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceMuted },
  card: { gap: spacing.xs, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  canvas: { alignSelf: 'center', borderRadius: cardRadii.compact, overflow: 'hidden' },
  layerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44, paddingHorizontal: spacing.sm, borderRadius: 10, backgroundColor: colors.surfaceElevated },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: 22, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...textStyles.bodyMedium, color: colors.textPrimary },
  chipTextOn: { color: colors.textOnPrimary, fontWeight: '700' },
});
