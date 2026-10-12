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
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { OymoArtwork } from '../components/OymoArtwork';
import { toCreatorState } from '../remix/remixModel';
import { applyAlternative, CHOOSABLE, colorLabSource, colorName, contrastRatio, HARD_TO_TELL, inspect, isUnchanged, NO_ALTERNATIVE, simulateDesign, suggest, VISIONS, type Alternative, type Vision } from './colorLabModel';

/**
 * /culture/oymo/colors - Color Lab (colorLabModel.ts): the design's palette
 * with text names and contrast, which colours may be hard to tell apart,
 * grayscale and approximate colour-vision previews, and a user-controlled
 * alternative that opens in the Creator as an unsaved copy. Original and
 * alternative are drawn with the same renderer (OymoArtwork).
 */
export function ColorLabScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const owner = useRecordsOwner();
  const [source] = useState(() => colorLabSource(owner));
  const [vision, setVision] = useState<Vision>('normal');
  const [alternative, setAlternative] = useState<Alternative>(NO_ALTERNATIVE);
  const [editing, setEditing] = useState<string | null>(null);
  const design = source?.design ?? null;
  const altDesign = useMemo(() => (design ? applyAlternative(design, alternative) : null), [design, alternative]);
  const suggestion = useMemo(() => (design ? suggest(design) : null), [design]);
  const label = (hex: string) => {
    const name = colorName(hex);
    return t('colorLab.colorName', { name: t(`colorLab.names.${name.lightness}_${name.hue}`, { defaultValue: t(`colorLab.hues.${name.hue}`) }), hex: name.hex });
  };

  if (!design || !altDesign) {
    return (
      <View style={styles.root}>
        <Header title={t('colorLab.title')} onPressBack={onPressBack} />
        <View style={[styles.content, styles.stack]} testID="color-lab-no-design">
          <Text style={styles.body}>{t('colorLab.noDesign')}</Text>
          <Button label={t('common.back')} onPress={onPressBack} />
        </View>
      </View>
    );
  }
  const report = inspect(design, vision);
  const altReport = inspect(altDesign, vision);
  const size = Math.min((width - spacing.lg * 2 - spacing.sm) / 2, 220);
  const changed = !isUnchanged(alternative);
  const replace = (from: string, to: string) => {
    setAlternative((current) => ({ ...current, replacements: { ...current.replacements, [from]: to } }));
    setEditing(null);
    announce(t('colorLab.replaced', { from: label(from), to: label(to) }));
  };
  const openInCreator = () => {
    const copy = toCreatorState(altDesign); // exactly the previewed alternative
    handOffToCreator(copy.state, { symmetry: copy.symmetry, source: 'colorLab', name: source?.name ? t('colorLab.copyName', { name: source.name }) : undefined });
    router.push('/culture/oymo/create' as never);
  };

  return (
    <View style={styles.root}>
      <Header title={t('colorLab.title')} onPressBack={onPressBack} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} testID="color-lab">
        <Text style={styles.body}>{t('colorLab.intro')}</Text>
        <Text style={styles.note} testID="color-lab-disclaimer">
          {t('colorLab.disclaimer')}
        </Text>

        <Text style={styles.section}>{t('colorLab.viewTitle')}</Text>
        <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel={t('colorLab.viewTitle')}>
          {VISIONS.map((option) => (
            <AnimatedPressable key={option} style={[styles.chip, vision === option && styles.chipOn]} onPress={() => setVision(option)} accessibilityRole="radio" accessibilityState={{ checked: vision === option }} aria-checked={vision === option} testID={`color-lab-view-${option}`}>
              <Text style={[styles.chipText, vision === option && styles.chipTextOn]}>{t(`colorLab.views.${option}`)}</Text>
            </AnimatedPressable>
          ))}
        </View>
        {vision !== 'normal' && vision !== 'grayscale' ? <Text style={styles.meta}>{t('colorLab.approximation')}</Text> : null}

        <View style={styles.compare}>
          <View style={styles.compareCell} testID="color-lab-original">
            <Text style={styles.label}>{t('colorLab.original')}</Text>
            <View accessible accessibilityRole="image" accessibilityLabel={t('colorLab.previewA11y', { which: t('colorLab.original'), view: t(`colorLab.views.${vision}`) })}>
              <OymoArtwork {...simulateDesign(design, vision)} symmetryMode={design.symmetry} size={size} />
            </View>
            <Text style={styles.meta}>{t('colorLab.weakest', { ratio: report.pairs[0]?.ratio ?? 21 })}</Text>
          </View>
          <View style={styles.compareCell} testID="color-lab-alternative">
            <Text style={styles.label}>{changed ? t('colorLab.alternative') : t('colorLab.alternativeSame')}</Text>
            <View accessible accessibilityRole="image" accessibilityLabel={t('colorLab.previewA11y', { which: t('colorLab.alternative'), view: t(`colorLab.views.${vision}`) })}>
              <OymoArtwork {...simulateDesign(altDesign, vision)} symmetryMode={altDesign.symmetry} size={size} />
            </View>
            <Text style={styles.meta} testID="color-lab-alt-weakest">
              {t('colorLab.weakest', { ratio: altReport.pairs[0]?.ratio ?? 21 })}
            </Text>
          </View>
        </View>

        <Text style={styles.section} accessibilityRole="header">
          {t('colorLab.paletteTitle')}
        </Text>
        <SwatchRow hex={design.backgroundColor} text={`${t('colorLab.background')}: ${label(design.backgroundColor)}`} testID="color-lab-background" />
        {alternative.background ? <SwatchRow hex={alternative.background} text={`${t('colorLab.newBackground')}: ${label(alternative.background)}`} /> : null}
        {report.colors.map((hex, index) => {
          const to = alternative.replacements[hex];
          return (
            <View key={hex} style={styles.card} testID={`color-lab-color-${index}`}>
              <SwatchRow hex={hex} text={`${label(hex)} - ${t('colorLab.onBackground', { ratio: contrastRatio(hex, altDesign.backgroundColor) })}`} />
              {to ? <SwatchRow hex={to} text={`→ ${label(to)}`} /> : null}
              <View style={styles.wrap}>
                <Button label={t('colorLab.replace')} variant="secondary" size="sm" onPress={() => setEditing(editing === hex ? null : hex)} testID={`color-lab-replace-${index}`} />
                {to ? <Button label={t('colorLab.keepOriginal')} variant="text" size="sm" onPress={() => setAlternative((current) => { const next = { ...current.replacements }; delete next[hex]; return { ...current, replacements: next }; })} /> : null}
              </View>
              {editing === hex ? (
                <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel={t('colorLab.chooseFor', { color: label(hex) })}>
                  {CHOOSABLE.map((option) => (
                    <AnimatedPressable key={option} style={[styles.swatchButton, { backgroundColor: option }]} onPress={() => replace(hex, option)} accessibilityRole="radio" accessibilityState={{ checked: to === option }} aria-checked={to === option} accessibilityLabel={label(option)} testID={`color-lab-pick-${index}-${option.slice(1)}`}>
                      {null}
                    </AnimatedPressable>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}

        <Text style={styles.section} accessibilityRole="header">
          {t('colorLab.hardTitle', { view: t(`colorLab.views.${vision}`) })}
        </Text>
        <Text style={styles.meta}>{t('colorLab.hardRule', { min: HARD_TO_TELL })}</Text>
        {report.hard.length === 0 ? (
          <Text style={styles.body} testID="color-lab-no-hard">
            {t('colorLab.noHard')}
          </Text>
        ) : (
          report.hard.map((pair) => (
            <Text key={`${pair.a}-${pair.b}`} style={styles.body} testID="color-lab-hard-pair">
              • {pair.withBackground ? t('colorLab.pairBackground', { a: label(pair.a), ratio: pair.ratio }) : t('colorLab.pair', { a: label(pair.a), b: label(pair.b), ratio: pair.ratio })}
            </Text>
          ))
        )}

        {suggestion ? (
          <View style={styles.card} testID="color-lab-suggestion">
            <Text style={styles.cardTitle}>{t('colorLab.suggestionTitle')}</Text>
            <Text style={styles.meta}>{t('colorLab.suggestionBody', { palette: t(`remixStudio.palettes.${suggestion.palette}`), ratio: suggestion.minRatio })}</Text>
            <Button label={t('colorLab.previewSuggestion')} variant="secondary" size="sm" onPress={() => setAlternative(suggestion.alternative)} testID="color-lab-preview-suggestion" />
          </View>
        ) : null}
        {changed ? <Button label={t('colorLab.reset')} variant="text" onPress={() => setAlternative(NO_ALTERNATIVE)} testID="color-lab-reset" /> : null}

        <Button label={t('colorLab.openCopy')} disabled={!changed} onPress={openInCreator} testID="color-lab-open-copy" />
        <Text style={styles.meta}>{t('colorLab.copyNote')}</Text>
      </ScrollView>
    </View>
  );
}

function Header({ title, onPressBack }: { title: string; onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
      <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
        {title}
      </Text>
    </View>
  );
}

function SwatchRow({ hex, text, testID }: { hex: string; text: string; testID?: string }) {
  return (
    <View style={styles.swatchRow} testID={testID}>
      <View style={[styles.swatch, { backgroundColor: hex }]} />
      <Text style={[styles.body, styles.flex]}>{text}</Text>
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
  section: { ...typography.overline, color: colors.textSecondary, marginTop: spacing.sm },
  label: { ...textStyles.overline, color: colors.primary },
  body: { ...textStyles.body, color: colors.textPrimary },
  meta: { ...textStyles.small, color: colors.textSecondary },
  note: { ...textStyles.small, color: colors.textPrimary, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceMuted },
  card: { gap: spacing.xs, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  cardTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  compare: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' },
  compareCell: { gap: spacing.xs, alignItems: 'center' },
  swatchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: colors.textSecondary },
  swatchButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.textSecondary },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: 22, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...textStyles.bodyMedium, color: colors.textPrimary },
  chipTextOn: { color: colors.textOnPrimary, fontWeight: '700' },
});
