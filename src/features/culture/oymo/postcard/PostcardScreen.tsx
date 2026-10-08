import { ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button, IconButton } from '@/components/ui';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { useOymoCreations } from '@/services/content/oymoCreationsService';
import { useShareCard } from '@/services/share/useShareCard';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { BACKGROUNDS, cardSize, cleanGreeting, FORMATS, GREETING_MAX, greetingLength, LAYOUTS, POSITIONS, SIZES, startPostcard, typedGreeting, type PostcardComposition } from './postcardModel';
import { PostcardView } from './PostcardView';

/**
 * /culture/oymo/postcard?pattern=<saved id> - compose a postcard from a
 * COPY of one saved pattern: format, layout, an optional greeting, the
 * pattern's size/position and the background. Nothing is written back to
 * the saved pattern and nothing is uploaded. "Preview, then share or save"
 * opens the shared preview sheet showing the exact card that is exported;
 * if the export fails the composition stays here, unchanged.
 */
export function PostcardScreen({ patternId, onPressBack }: { patternId: string; onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { experience } = useAgeExperience();
  const { data: creations, isLoading } = useOymoCreations();
  const { share, shareHost } = useShareCard();
  const source = creations?.find((creation) => creation.id === patternId) ?? null;
  const [composition, setComposition] = useState<PostcardComposition | null>(null);
  // Copied once, the first time the saved pattern is available.
  const current = composition ?? (source ? startPostcard(source) : null);
  const update = (patch: Partial<PostcardComposition>) => current && setComposition({ ...current, ...patch });

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
      <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
        {t('postcard.title')}
      </Text>
    </View>
  );

  if (!current) {
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
  const previewWidth = Math.min(width - spacing.lg * 2, 360);
  const scale = previewWidth / size.width;
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

        <Text style={styles.section} accessibilityRole="header">
          {t('postcard.preview')}
        </Text>
        <View style={[styles.previewBox, { width: previewWidth, height: size.height * scale }]} accessible accessibilityRole="image" accessibilityLabel={`${t('postcard.previewA11y')}. ${cleanGreeting(current.greeting)}`} testID="postcard-preview">
          <View style={{ width: size.width, height: size.height, transform: [{ scale }], transformOrigin: 'top left' as never }}>
            <PostcardView composition={current} />
          </View>
        </View>

        {choices(t('postcard.format'), FORMATS, current.format, (option) => t(`postcard.formats.${option}`), (format) => update({ format }), 'format')}
        {choices(t('postcard.layout'), LAYOUTS, current.layout, (option) => t(`postcard.layouts.${option}`), (layout) => update({ layout }), 'layout')}

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

        {choices(t('postcard.size'), SIZES, current.size, (option) => t(`postcard.sizes.${option}`), (value) => update({ size: value }), 'size')}
        {current.layout !== 'border' ? choices(t('postcard.position'), POSITIONS, current.position, (option) => t(`postcard.positions.${option}`), (position) => update({ position }), 'position') : null}
        {choices(t('postcard.background'), BACKGROUNDS, current.background, (option) => t(`postcard.backgrounds.${option}`), (background) => update({ background }), 'background')}

        <Text style={styles.meta}>{t('postcard.onlyChosen')}</Text>
        {Platform.OS === 'web' ? <Text style={styles.meta}>{t('postcard.webNote')}</Text> : null}
        <Button label={t('postcard.shareOrSave')} size={experience === 'child' ? 'lg' : 'md'} block onPress={onExport} testID="postcard-export" />
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
