import { ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button, IconButton, Toggle } from '@/components/ui';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { useOymoCreations } from '@/services/content/oymoCreationsService';
import { useShareCard } from '@/services/share/useShareCard';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { BACKGROUNDS, cardSize, cleanGreeting, CLOCK_ZONE, compositionFor, exportSize, FORMATS, GREETING_MAX, greetingLength, LAYOUTS, POSITIONS, SIZES, startDesignSet, typedGreeting, updatePlacement, updateShared, type DesignSet, type OutputPlacement, type PostcardFormat } from './postcardModel';
import { PostcardView } from './PostcardView';

/**
 * /culture/oymo/postcard?pattern=<saved id> - a matching DESIGN SET from a
 * COPY of one saved pattern: a square card, a portrait card and a phone
 * wallpaper. The greeting and background (palette) are shared; layout,
 * size and position are set per output. Nothing is written back to the
 * saved pattern and nothing is uploaded. "Preview, then share or save"
 * opens the shared preview sheet with the exact image of the SELECTED
 * output; if the export fails, every output stays here, unchanged.
 */
export function PostcardScreen({ patternId, onPressBack }: { patternId: string; onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { experience } = useAgeExperience();
  const { data: creations, isLoading } = useOymoCreations();
  const { share, shareHost } = useShareCard();
  const source = creations?.find((creation) => creation.id === patternId) ?? null;
  const [designSet, setDesignSet] = useState<DesignSet | null>(null);
  const [selected, setSelected] = useState<PostcardFormat>('portrait');
  const [clockGuide, setClockGuide] = useState(true);
  // Copied once, the first time the saved pattern is available.
  const set = designSet ?? (source ? startDesignSet(source) : null);
  const current = set ? compositionFor(set, selected) : null;
  const update = (patch: Partial<Pick<DesignSet, 'greeting' | 'background'>> | Partial<OutputPlacement>) => {
    if (!set) return;
    const { greeting, background, ...placement } = patch as Partial<DesignSet & OutputPlacement>;
    let next = set;
    if (greeting !== undefined || background !== undefined) next = updateShared(next, { ...(greeting !== undefined ? { greeting } : {}), ...(background !== undefined ? { background } : {}) });
    if (Object.keys(placement).length > 0) next = updatePlacement(next, selected, placement);
    setDesignSet(next);
  };

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
      <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
        {t('postcard.title')}
      </Text>
    </View>
  );

  if (!current || !set) {
    return (
      <View style={styles.root}>
        {header}
        <View style={styles.content}>
          <Text style={styles.body} testID={isLoading ? 'postcard-loading' : 'postcard-not-found'}>
            {isLoading ? t('postcard.loading') : t('postcard.notFound')}
          </Text>
          <Button label={t('postcard.back')} variant="secondary" onPress={onPressBack} />
        </View>
      </View>
    );
  }

  const size = cardSize(current.format);
  // The wallpaper preview stays a comfortable height on a phone screen.
  const previewWidth = Math.min(width - spacing.lg * 2, current.format === 'wallpaper' ? 220 : 360);
  const scale = previewWidth / size.width;
  const outputName = (format: PostcardFormat) => t(`postcard.formats.${format}`);
  const dims = (format: PostcardFormat) => t('postcard.dimensions', exportSize(format));
  const typed = greetingLength(current.greeting);
  const title = cleanGreeting(current.greeting) || t('postcard.defaultTitle');

  const onExport = () =>
    void share(
      {
        variant: 'postcard',
        title,
        label: t('postcard.label'),
        imageSource: null,
        cardSize: size,
        artwork: <PostcardView composition={current} />,
      },
      cleanGreeting(current.greeting) || t('postcard.defaultTitle'),
    );

  const choices = <T extends string>(heading: string, options: readonly T[], selected: T, labelOf: (option: T) => string, onSelect: (option: T) => void, id: string) => (
    <View style={styles.group}>
      <Text style={styles.section} accessibilityRole="header">
        {heading}
      </Text>
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={heading}>
        {options.map((option) => {
          const on = option === selected;
          return (
            <AnimatedPressable key={option} style={[styles.choice, on && styles.choiceOn]} onPress={() => onSelect(option)} accessibilityRole="radio" accessibilityState={{ checked: on }} aria-checked={on} accessibilityLabel={labelOf(option)} testID={`postcard-${id}-${option}`}>
              <Text style={[styles.choiceText, on && styles.choiceTextOn]}>{labelOf(option)}</Text>
            </AnimatedPressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      {header}
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.meta} testID="postcard-copy-note">
          {t('postcard.copyNote')}
        </Text>

        {/* The three outputs: one shared design, each with its own placement. */}
        <Text style={styles.section} accessibilityRole="header">
          {t('postcard.outputs')}
        </Text>
        <Text style={styles.meta}>{t('postcard.outputsHint')}</Text>
        <View style={styles.outputs} accessibilityRole="radiogroup" accessibilityLabel={t('postcard.outputs')}>
          {FORMATS.map((format) => {
            const on = format === selected;
            const thumbWidth = 88;
            const thumb = cardSize(format);
            const thumbScale = thumbWidth / thumb.width;
            return (
              <AnimatedPressable key={format} style={[styles.output, on && styles.outputOn]} onPress={() => setSelected(format)} accessibilityRole="radio" accessibilityState={{ checked: on }} aria-checked={on} accessibilityLabel={t('postcard.outputA11y', { output: outputName(format), ...exportSize(format) })} testID={`postcard-format-${format}`}>
                <View style={{ width: thumbWidth, height: thumb.height * thumbScale, overflow: 'hidden', borderRadius: 4 }} testID={`postcard-thumb-${format}`}>
                  <View style={{ width: thumb.width, height: thumb.height, transform: [{ scale: thumbScale }], transformOrigin: 'top left' as never }}>
                    <PostcardView composition={compositionFor(set, format)} />
                  </View>
                </View>
                <Text style={[styles.outputName, on && styles.bold]}>{outputName(format)}</Text>
                <Text style={styles.meta} testID={`postcard-dims-${format}`}>
                  {dims(format)}
                </Text>
              </AnimatedPressable>
            );
          })}
        </View>

        <Text style={styles.section} accessibilityRole="header">
          {t('postcard.preview')} · {outputName(current.format)} · {dims(current.format)}
        </Text>
        <View style={[styles.previewBox, { width: previewWidth, height: size.height * scale }]} accessible accessibilityRole="image" accessibilityLabel={`${t('postcard.previewA11y')}. ${outputName(current.format)}. ${cleanGreeting(current.greeting)}`} testID="postcard-preview">
          <View style={{ width: size.width, height: size.height, transform: [{ scale }], transformOrigin: 'top left' as never }}>
            <PostcardView composition={current} />
            {current.format === 'wallpaper' && clockGuide ? (
              // A guide drawn over the preview only - it is not part of the exported image.
              <View pointerEvents="none" style={[styles.clockGuide, { left: CLOCK_ZONE.x, top: CLOCK_ZONE.y, width: CLOCK_ZONE.width, height: CLOCK_ZONE.height }]} testID="postcard-clock-guide">
                <Text style={styles.clockGuideText}>{t('postcard.clockGuide')}</Text>
              </View>
            ) : null}
          </View>
        </View>
        {current.format === 'wallpaper' ? (
          <View style={styles.group}>
            <View style={styles.toggleRow}>
              <Text style={[styles.body, styles.flex]}>{t('postcard.showClockGuide')}</Text>
              <Toggle value={clockGuide} onValueChange={setClockGuide} accessibilityLabel={t('postcard.showClockGuide')} />
            </View>
            <Text style={styles.meta}>{t('postcard.clockGuideNote')}</Text>
          </View>
        ) : null}

        <Text style={styles.heading} accessibilityRole="header">
          {t('postcard.adjustFor', { output: outputName(current.format) })}
        </Text>
        {choices(t('postcard.layout'), LAYOUTS, current.layout, (option) => t(`postcard.layouts.${option}`), (layout) => update({ layout }), 'layout')}
        {choices(t('postcard.size'), SIZES, current.size, (option) => t(`postcard.sizes.${option}`), (value) => update({ size: value }), 'size')}
        {current.layout !== 'border' ? choices(t('postcard.position'), POSITIONS, current.position, (option) => t(`postcard.positions.${option}`), (position) => update({ position }), 'position') : null}

        <Text style={styles.heading} accessibilityRole="header">
          {t('postcard.sharedTitle')}
        </Text>
        <View style={styles.group}>
          <Text style={styles.section} accessibilityRole="header" nativeID="postcard-greeting-label">
            {t('postcard.greeting')}
          </Text>
          <Text style={styles.meta}>{t('postcard.greetingHint', { max: GREETING_MAX })}</Text>
          <TextInput
            value={current.greeting}
            onChangeText={(value) => update({ greeting: typedGreeting(value) })}
            placeholder={t('postcard.greetingPlaceholder')}
            placeholderTextColor={colors.textMuted}
            style={[styles.input, experience === 'child' && styles.inputLarge]}
            multiline
            accessibilityLabel={t('postcard.greeting')}
            accessibilityHint={t('postcard.greetingHint', { max: GREETING_MAX })}
            testID="postcard-greeting-input"
          />
          <Text style={[styles.counter, typed >= GREETING_MAX && styles.counterFull]} accessibilityLiveRegion="polite" testID="postcard-greeting-count">
            {t('postcard.greetingCount', { count: typed, max: GREETING_MAX })}
            {typed >= GREETING_MAX ? ` · ${t('postcard.greetingFull', { max: GREETING_MAX })}` : ''}
          </Text>
        </View>

        {choices(t('postcard.background'), BACKGROUNDS, current.background, (option) => t(`postcard.backgrounds.${option}`), (background) => update({ background }), 'background')}

        <Text style={styles.meta}>{t('postcard.onlyChosen')}</Text>
        {Platform.OS === 'web' ? <Text style={styles.meta}>{t('postcard.webNote')}</Text> : null}
        <Button label={t('postcard.exportSelected', { output: outputName(current.format) })} size={experience === 'child' ? 'lg' : 'md'} block onPress={onExport} testID="postcard-export" />
      </ScrollView>
      {shareHost}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  group: { gap: spacing.xs },
  section: { ...typography.overline, color: colors.textSecondary, marginTop: spacing.sm },
  body: { ...textStyles.body, color: colors.textPrimary },
  meta: { ...textStyles.small, color: colors.textSecondary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  flex: { flex: 1 },
  bold: { fontWeight: '700' },
  heading: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary, marginTop: spacing.sm },
  outputs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'flex-end' },
  output: { gap: 4, padding: spacing.xs, alignItems: 'center', borderRadius: cardRadii.compact, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.surface },
  outputOn: { borderWidth: 2, borderColor: colors.primary },
  outputName: { ...textStyles.small, color: colors.textPrimary, textAlign: 'center' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  clockGuide: { position: 'absolute', borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.9)', backgroundColor: 'rgba(19,32,24,0.35)', alignItems: 'center', justifyContent: 'center' },
  clockGuideText: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textOnPrimary },
  choice: { minHeight: 44, paddingHorizontal: spacing.md, justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.surface },
  choiceOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  choiceText: { ...textStyles.bodyMedium, color: colors.textPrimary },
  choiceTextOn: { color: colors.textOnPrimary, fontWeight: '700' },
  previewBox: { alignSelf: 'center', overflow: 'hidden', borderRadius: 8, borderWidth: 1, borderColor: colors.borderSubtle },
  input: { ...textStyles.body, color: colors.textPrimary, minHeight: 72, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, textAlignVertical: 'top', borderRadius: cardRadii.compact, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.surface },
  inputLarge: { fontSize: 19, lineHeight: 28 },
  counter: { ...textStyles.small, color: colors.textSecondary, alignSelf: 'flex-end' },
  counterFull: { color: colors.textPrimary, fontWeight: '700' },
});
