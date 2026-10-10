import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button, IconButton } from '@/components/ui';
import { useRecordsOwner } from '@/features/games/records/useGameRecords';
import { announce } from '@/services/a11y/announce';
import { handOffToCreator } from '@/services/culture/oymoHandoff';
import type { SymmetryMode } from '@/services/culture/symmetry';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { OymoArtwork } from '../components/OymoArtwork';
import { applyRemix, describeChanges, describeDesign, NO_CHANGE, PALETTES, REMIX_BACKGROUNDS, remixSource, symmetryOptions, toCreatorState, type Change, type PaletteId, type RemixChoice, type RemixDesign } from './remixModel';

/** Readable names for the colours the studio offers (and the Creator's own); anything else is "another colour". */
const COLOR_NAMES: Record<string, string> = {
  [colors.surfaceAlt.toLowerCase()]: 'cream',
  [colors.surface.toLowerCase()]: 'lightCream',
  [colors.surfaceFeature.toLowerCase()]: 'darkGreen',
  [colors.accentGold.toLowerCase()]: 'gold',
};

/**
 * /culture/oymo/remix - variations of the design open in the Creator,
 * made from the Creator's own changes (palette, background, symmetry).
 * Original and variation side by side plus the same comparison as a list.
 * The variation opens as an unsaved copy; the original design and its
 * recipe are never changed. No animation; all on this device.
 */
export function RemixStudioScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const owner = useRecordsOwner();
  const [original] = useState<RemixDesign | null>(() => remixSource(owner));
  const [choice, setChoice] = useState<RemixChoice>(NO_CHANGE);

  const variation = useMemo(() => (original ? applyRemix(original, choice) : null), [original, choice]);
  const changes = useMemo(() => (original ? describeChanges(original, choice) : []), [original, choice]);

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
      <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
        {t('remixStudio.title')}
      </Text>
    </View>
  );

  if (!original || !variation) {
    return (
      <View style={styles.root}>
        {header}
        <View style={styles.content}>
          <Text style={styles.body} testID="remix-none">
            {t('remixStudio.noDesign')}
          </Text>
          <Button label={t('remixStudio.back')} variant="secondary" onPress={onPressBack} />
        </View>
      </View>
    );
  }

  const colorName = (hex: string) => t(`remixStudio.colors.${COLOR_NAMES[hex.toLowerCase()] ?? 'other'}`);
  const modeName = (mode: SymmetryMode) => t(`culture.oymo.symmetry.${mode}`);
  const changeText = (change: Change) =>
    change.kind === 'palette'
      ? t('remixStudio.change.palette', { palette: t(`remixStudio.palettes.${change.palette}`), count: change.recoloured })
      : change.kind === 'background'
        ? t('remixStudio.change.background', { from: colorName(change.from), to: colorName(change.to) })
        : change.to === 'none'
          ? t('remixStudio.change.symmetryRemoved')
          : t(change.mergedLayers > 0 ? 'remixStudio.change.symmetryMerged' : `remixStudio.change.symmetry.${change.to}`, { mode: modeName(change.to), count: change.mergedLayers });
  const update = (next: Partial<RemixChoice>) => {
    const merged = { ...choice, ...next };
    setChoice(merged);
    const after = describeChanges(original, merged);
    announce(after.length ? after.map(changeText).join('. ') : t('remixStudio.noChanges'));
  };

  const compareSize = Math.min(Math.floor((width - spacing.lg * 2 - spacing.md) / 2), 180);
  const describe = (design: RemixDesign) => {
    const facts = describeDesign(design);
    return [
      t('remixStudio.facts.layers', { count: facts.layers }),
      t('remixStudio.facts.shown', { count: facts.shownMotifs }),
      t('remixStudio.facts.colors', { count: facts.colors.length }),
      t('remixStudio.facts.background', { color: colorName(facts.backgroundColor) }),
      t('remixStudio.facts.symmetry', { mode: modeName(facts.symmetry) }),
    ];
  };

  const open = () => {
    const copy = toCreatorState(variation);
    handOffToCreator(copy.state, { symmetry: copy.symmetry, source: 'remix' });
    router.push('/culture/oymo/create' as never);
  };


  return (
    <View style={styles.root}>
      {header}
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>
        <Text style={styles.meta}>{t('remixStudio.intro')}</Text>

        <View style={styles.compare}>
          {[
            { key: 'original', design: original, label: t('remixStudio.original') },
            { key: 'variation', design: variation, label: t('remixStudio.variation') },
          ].map((side) => (
            <View key={side.key} style={styles.side}>
              <Text style={styles.sideLabel}>{side.label}</Text>
              <View style={[styles.stage, { width: compareSize, height: compareSize }]} accessible accessibilityRole="image" accessibilityLabel={`${side.label}. ${describe(side.design).join('. ')}`} testID={`remix-${side.key}`}>
                <OymoArtwork layers={side.design.layers} backgroundColor={side.design.backgroundColor} symmetryMode={side.design.symmetry} size={compareSize} />
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.section} accessibilityRole="header">
          {t('remixStudio.whatChanged')}
        </Text>
        <View accessibilityLiveRegion="polite" testID="remix-changes">
          {changes.length === 0 ? (
            <Text style={styles.body}>{t('remixStudio.noChanges')}</Text>
          ) : (
            changes.map((change) => (
              <Text key={change.kind} style={styles.body} testID={`remix-change-${change.kind}`}>
                • {changeText(change)}
              </Text>
            ))
          )}
        </View>

        <Text style={styles.section} accessibilityRole="header">
          {t('remixStudio.listTitle')}
        </Text>
        <View style={styles.list} testID="remix-list">
          {[
            { key: 'original', label: t('remixStudio.original'), design: original },
            { key: 'variation', label: t('remixStudio.variation'), design: variation },
          ].map((side) => (
            <View key={side.key} style={styles.listColumn}>
              <Text style={styles.cardTitle}>{side.label}</Text>
              {describe(side.design).map((line) => (
                <Text key={line} style={styles.meta}>
                  {line}
                </Text>
              ))}
            </View>
          ))}
        </View>

        <Text style={styles.section} accessibilityRole="header">
          {t('remixStudio.palette')}
        </Text>
        <View style={styles.options}>
          <Option id="remix-palette-keep" label={t('remixStudio.keep')} selected={choice.palette === null} design={applyRemix(original, { ...choice, palette: null })} onPress={() => update({ palette: null })} />
          {PALETTES.map((palette) => (
            <Option key={palette.id} id={`remix-palette-${palette.id}`} label={t(`remixStudio.palettes.${palette.id}`)} selected={choice.palette === palette.id} design={applyRemix(original, { ...choice, palette: palette.id as PaletteId })} onPress={() => update({ palette: palette.id })} />
          ))}
        </View>

        <Text style={styles.section} accessibilityRole="header">
          {t('remixStudio.background')}
        </Text>
        <View style={styles.options}>
          <Option id="remix-background-keep" label={t('remixStudio.keep')} selected={choice.background === null} design={applyRemix(original, { ...choice, background: null })} onPress={() => update({ background: null })} />
          {REMIX_BACKGROUNDS.filter((color) => color.toLowerCase() !== original.backgroundColor.toLowerCase()).map((color) => (
            <Option key={color} id={`remix-background-${COLOR_NAMES[color.toLowerCase()]}`} label={colorName(color)} selected={choice.background === color} design={applyRemix(original, { ...choice, background: color })} onPress={() => update({ background: color })} />
          ))}
        </View>

        <Text style={styles.section} accessibilityRole="header">
          {t('remixStudio.symmetry')}
        </Text>
        <View style={styles.options}>
          <Option id="remix-symmetry-keep" label={t('remixStudio.keep')} selected={choice.symmetry === null} design={applyRemix(original, { ...choice, symmetry: null })} onPress={() => update({ symmetry: null })} />
          {symmetryOptions(original).map((option) => (
            <Option
              key={option.mode}
              id={`remix-symmetry-${option.mode}`}
              label={modeName(option.mode)}
              selected={choice.symmetry === option.mode}
              disabled={!option.available}
              hint={option.reason === 'current' ? t('remixStudio.symmetryCurrent') : option.reason === 'copiesInLayers' ? t('remixStudio.symmetryInLayers') : undefined}
              design={applyRemix(original, { ...choice, symmetry: option.available ? option.mode : null })}
              onPress={() => update({ symmetry: option.mode })}
            />
          ))}
        </View>

        <Button label={t('remixStudio.open')} onPress={open} disabled={changes.length === 0} accessibilityHint={t('remixStudio.openHint')} testID="remix-open" />
        <Text style={styles.meta}>{t('remixStudio.openHint')}</Text>
        <Button label={t('remixStudio.back')} variant="secondary" onPress={onPressBack} testID="remix-back" />
        <Text style={styles.meta}>{t('remixStudio.localNote')}</Text>
      </ScrollView>
    </View>
  );
}

function Option({ id, label, selected, disabled, design, onPress, hint }: { id: string; label: string; selected: boolean; disabled?: boolean; design: RemixDesign; onPress: () => void; hint?: string }) {
  return (
    <AnimatedPressable style={[styles.option, selected && styles.optionOn, disabled && styles.optionOff]} onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ selected, disabled: !!disabled }} accessibilityLabel={hint ? `${label}. ${hint}` : label} testID={id}>
      <View style={styles.thumb} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <OymoArtwork layers={design.layers} backgroundColor={design.backgroundColor} symmetryMode={design.symmetry} size={THUMB} />
      </View>
      <Text style={[styles.optionText, selected && styles.optionTextOn]} numberOfLines={2}>
        {label}
      </Text>
      {hint ? (
        <Text style={styles.optionHint} numberOfLines={3}>
          {hint}
        </Text>
      ) : null}
    </AnimatedPressable>
  );
}

const THUMB = 56;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  section: { ...typography.overline, color: colors.textSecondary },
  body: { ...textStyles.body, color: colors.textPrimary },
  cardTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  meta: { ...textStyles.small, color: colors.textSecondary },
  compare: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md },
  side: { alignItems: 'center', gap: spacing.xs },
  sideLabel: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  stage: { borderRadius: cardRadii.compact, overflow: 'hidden', borderWidth: 1, borderColor: colors.borderSubtle },
  list: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  listColumn: { flexGrow: 1, flexBasis: 140, gap: 2 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  option: { width: 104, minHeight: 44, padding: spacing.xs, gap: 4, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.surface },
  optionOn: { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.surfaceAlt },
  optionOff: { borderStyle: 'dashed' },
  optionText: { ...textStyles.small, color: colors.textPrimary, textAlign: 'center' },
  optionTextOn: { fontWeight: '700' },
  optionHint: { ...textStyles.small, fontSize: 12, color: colors.textSecondary, textAlign: 'center' },
  thumb: { width: 56, height: 56, borderRadius: 8, overflow: 'hidden' },
});
