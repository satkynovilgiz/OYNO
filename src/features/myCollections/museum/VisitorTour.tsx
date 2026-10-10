import { router } from 'expo-router';
import { Check, ChevronRight, ImageOff, Landmark, WifiOff } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, TextInput, View, type ImageSourcePropType } from 'react-native';

import { contentTypeMeta } from '@/components/library/contentTypeMeta';
import { AnimatedPressable, Button, ProgressBar, Toggle } from '@/components/ui';
import { announce } from '@/services/a11y/announce';
import type { CatalogContentType } from '@/services/content/contentCatalog';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import type { Exhibition, ExhibitSlide } from './museumModel';
import { NarrationPlayback } from './Narration';
import { buildTour, closingRows, currentIndex, exhibitSteps, RESPONSE_MAX, START_TOUR, tourExhibits, tourReducer, type TourAction, type TourState } from './tourModel';

/**
 * The guided visitor mode of a Mini Museum (visitorTour.ts has the rules).
 * Shows ONLY: the exhibition title and introduction (the curator's words,
 * labelled), each exhibit's OYNO content (title, type, artwork, source
 * link), the curator's caption (labelled), and authored reflection
 * prompts. Never the collection's private description, Journal text or
 * notes. Responses and "viewed" live in this component only.
 */
export function VisitorTour({ exhibition, title, slides, isOffline, large, owner, onEnd }: { exhibition: Exhibition; title: string; slides: ExhibitSlide[]; isOffline: boolean; large: boolean; owner: string; onEnd: () => void }) {
  const { t } = useTranslation();
  const steps = useMemo(() => buildTour(exhibition, tourExhibits(slides, isOffline)), [exhibition, slides, isOffline]);
  const [state, setState] = useState<TourState>(START_TOUR);
  const [textFirst, setTextFirst] = useState(large);
  const index = currentIndex(steps, state);
  const step = steps[index];
  const exhibits = exhibitSteps(steps);
  const total = exhibits.length;
  const big = textFirst || large;

  // Steps are rebuilt as content resolves or the network changes: keep the visitor on the SAME step.
  useEffect(() => {
    setState((current) => tourReducer(steps, current, { type: 'sync' }));
  }, [steps]);

  const act = (action: TourAction) => {
    const next = tourReducer(steps, state, action);
    if (next === state) return;
    const entered = steps[currentIndex(steps, next)];
    if (next.current !== state.current && entered?.kind === 'exhibit') announce(t('museum.visit.exhibitOf', { current: entered.position + 1, total }));
    setState(next);
  };

  const nav = (
    <View style={styles.navRow}>
      {index > 0 ? <Button label={t('museum.visit.previous')} variant="secondary" onPress={() => act({ type: 'previous' })} testID="tour-previous" /> : null}
      {step.kind === 'reflection' ? <Button label={t('museum.visit.skip')} variant="text" onPress={() => act({ type: 'next' })} testID="tour-skip" /> : null}
      {step.kind !== 'closing' ? <Button label={step.kind === 'welcome' ? t('museum.visit.begin') : t('museum.visit.next')} onPress={() => act({ type: 'next' })} testID="tour-next" /> : null}
    </View>
  );

  const position = step.kind === 'exhibit' || step.kind === 'reflection' ? step.position + 1 : step.kind === 'closing' ? total : 0;

  return (
    <View style={styles.stack} testID="tour">
      {step.kind !== 'welcome' && total > 0 ? (
        <View accessible accessibilityRole="progressbar" accessibilityLabel={t('museum.visit.progressA11y', { current: position, total })} testID="tour-progress">
          <ProgressBar progress={total ? position / total : 0} height={6} />
          <Text style={styles.meta}>{t('museum.visit.exhibitOf', { current: position, total })}</Text>
        </View>
      ) : null}

      {step.kind === 'welcome' ? (
        <View style={styles.stack} testID="tour-welcome">
          <Text style={styles.kicker}>{t('museum.visit.welcomeTitle')}</Text>
          <Text style={[styles.heading, big && styles.headingLarge]} accessibilityRole="header">
            {title}
          </Text>
          <Text style={styles.meta}>{t('museum.visit.welcomeBy')}</Text>
          {exhibition.intro.trim() ? (
            <View style={styles.curatorBlock} testID="tour-intro">
              <Text style={styles.label}>{t('museum.visit.curatorIntro')}</Text>
              <Text style={[styles.body, big && styles.bodyLarge]}>{exhibition.intro}</Text>
            </View>
          ) : null}
          <Text style={styles.meta}>{t('museum.exhibitCount', { count: total })}</Text>
          <View style={styles.toggleRow}>
            <View style={styles.flex}>
              <Text style={styles.bodyBold}>{t('museum.visit.textFirst')}</Text>
              <Text style={styles.meta}>{t('museum.visit.textFirstHint')}</Text>
            </View>
            <Toggle value={textFirst} onValueChange={setTextFirst} accessibilityLabel={t('museum.visit.textFirst')} />
          </View>
        </View>
      ) : null}

      {step.kind === 'exhibit' ? <ExhibitView exhibit={step.exhibit} big={big} textFirst={textFirst} /> : null}
      {step.kind === 'exhibit' && step.exhibit.kind !== 'loading' ? <NarrationPlayback key={`${owner}:${step.exhibit.key}`} owner={owner} narration={exhibition.narrations?.[step.exhibit.key]} big={big} /> : null}

      {step.kind === 'reflection' ? (
        <View style={styles.stack} testID="tour-reflection">
          <Text style={styles.label}>{t('museum.visit.reflectionLabel')}</Text>
          <Text style={[styles.heading, big && styles.headingLarge]} accessibilityRole="header">
            {t(`museum.visit.prompts.${step.prompt}`)}
          </Text>
          <Text style={styles.meta}>{t('museum.visit.reflectionNote')}</Text>
          <TextInput
            value={state.responses[step.key] ?? ''}
            onChangeText={(text) => act({ type: 'respond', key: step.key, text })}
            maxLength={RESPONSE_MAX}
            multiline
            placeholder={t('museum.visit.responseLabel')}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={t('museum.visit.responseLabel')}
            style={[styles.input, big && styles.bodyLarge]}
            testID="tour-response"
          />
        </View>
      ) : null}

      {step.kind === 'closing' ? (
        <View style={styles.stack} testID="tour-closing">
          <Text style={[styles.heading, big && styles.headingLarge]} accessibilityRole="header">
            {t('museum.visit.closingTitle')}
          </Text>
          <Text style={styles.meta}>{t('museum.visit.closingIntro')}</Text>
          {closingRows(steps, state).map((row) => (
            <View key={row.key} style={styles.closingRow} testID={`tour-row-${row.position}`}>
              <View style={styles.flex}>
                <Text style={styles.bodyBold}>
                  {row.position + 1}. {row.title ?? (row.status === 'offline' ? t('museum.visit.offlineRow') : t('museum.visit.removedRow'))}
                </Text>
                <Text style={styles.meta}>{row.status === 'exhibit' ? (row.viewed ? t('museum.visit.viewed') : t('museum.visit.notViewed')) : row.status === 'offline' ? t('museum.visit.offlineRow') : t('museum.visit.removedRow')}</Text>
              </View>
              {row.route ? <Button label={t('museum.visit.openSource')} variant="text" onPress={() => router.push(row.route as never)} accessibilityHint={row.title ?? undefined} testID={`tour-source-${row.position}`} /> : null}
              {row.viewed ? <Check size={16} color={colors.primary} strokeWidth={2.5} /> : row.status === 'exhibit' ? <Button label={t('museum.visit.revisit')} variant="text" onPress={() => act({ type: 'goTo', index: row.stepIndex })} testID={`tour-revisit-${row.position}`} /> : null}
            </View>
          ))}
          <Text style={styles.meta} testID="tour-not-learning">
            {t('museum.visit.closingNote')}
          </Text>
          <Button label={t('museum.visit.restart')} variant="secondary" onPress={() => act({ type: 'restart' })} testID="tour-restart" />
          <Button label={t('museum.visit.endTour')} onPress={onEnd} testID="tour-end" />
        </View>
      ) : null}

      {nav}
    </View>
  );
}

function ExhibitView({ exhibit, big, textFirst }: { exhibit: ReturnType<typeof tourExhibits>[number]; big: boolean; textFirst: boolean }) {
  const { t } = useTranslation();
  const caption =
    exhibit.kind !== 'loading' && exhibit.caption ? (
      <View style={styles.captionBlock} testID="tour-caption">
        <Text style={styles.label}>{t('museum.visit.curatorCaption')}</Text>
        <Text style={[styles.body, big && styles.bodyLarge]}>{exhibit.caption}</Text>
      </View>
    ) : null;
  if (exhibit.kind === 'removed' || exhibit.kind === 'offline') {
    return (
      <View style={styles.stack} testID={`tour-exhibit-${exhibit.kind}`}>
        <View style={styles.noArtwork}>
          {exhibit.kind === 'offline' ? <WifiOff size={22} color={colors.textMuted} strokeWidth={2} /> : <Landmark size={22} color={colors.textMuted} strokeWidth={2} />}
          <Text style={[styles.body, big && styles.bodyLarge]}>{exhibit.kind === 'offline' ? t('museum.visit.offline') : t('museum.removed')}</Text>
        </View>
        {caption}
      </View>
    );
  }
  if (exhibit.kind === 'loading') return <Text style={styles.meta}>{t('museum.loading')}</Text>;
  const artwork = exhibit.content.thumbnail ? (
    <Image source={exhibit.content.thumbnail as ImageSourcePropType} style={[styles.artwork, textFirst && styles.artworkSmall]} resizeMode="cover" accessibilityLabel={exhibit.content.title} />
  ) : (
    <View style={[styles.noArtwork, textFirst && styles.artworkSmall]}>
      <ImageOff size={22} color={colors.textMuted} strokeWidth={2} />
      <Text style={styles.meta}>{t('museum.noArtwork')}</Text>
    </View>
  );
  const source = (
    <View style={styles.sourceBlock}>
      <Text style={styles.label}>{t('museum.fromOyno')}</Text>
      <Text style={styles.meta}>{t(contentTypeMeta(exhibit.contentType as CatalogContentType).labelKey)}</Text>
      <Text style={[styles.heading, big && styles.headingLarge]} accessibilityRole="header" testID="tour-exhibit-title">
        {exhibit.content.title}
      </Text>
      {exhibit.content.route ? (
        <AnimatedPressable style={styles.link} onPress={() => router.push(exhibit.content.route as never)} accessibilityRole="link" accessibilityLabel={t('museum.openSource', { name: exhibit.content.title })}>
          <Text style={styles.linkText}>{t('museum.openSource', { name: exhibit.content.title })}</Text>
          <ChevronRight size={14} color={colors.primary} strokeWidth={2} />
        </AnimatedPressable>
      ) : null}
    </View>
  );
  return (
    <View style={styles.stack} testID="tour-exhibit">
      {textFirst ? (
        <>
          {source}
          {caption}
          {artwork}
        </>
      ) : (
        <>
          {artwork}
          {source}
          {caption}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.sm },
  flex: { flex: 1, gap: 2 },
  kicker: { ...typography.overline, color: colors.textSecondary },
  heading: { ...typography.h2, color: colors.textPrimary },
  headingLarge: { fontSize: 26, lineHeight: 34 },
  label: { ...textStyles.overline, color: colors.primary },
  body: { ...textStyles.body, color: colors.textPrimary },
  bodyLarge: { fontSize: 20, lineHeight: 30 },
  bodyBold: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  meta: { ...textStyles.small, color: colors.textSecondary },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surface },
  curatorBlock: { gap: 2, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceAlt, borderLeftWidth: 3, borderLeftColor: colors.primary },
  captionBlock: { gap: 2, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceAlt, borderLeftWidth: 3, borderLeftColor: colors.primary },
  sourceBlock: { gap: 2 },
  artwork: { width: '100%', aspectRatio: 4 / 3, borderRadius: cardRadii.media, backgroundColor: colors.surfaceMuted },
  artworkSmall: { width: '60%', alignSelf: 'center' },
  noArtwork: { width: '100%', minHeight: 140, borderRadius: cardRadii.media, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', gap: spacing.xs, padding: spacing.md },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, alignSelf: 'flex-start' },
  linkText: { ...textStyles.small, fontWeight: '700', color: colors.primary },
  input: { ...textStyles.body, color: colors.textPrimary, minHeight: 96, padding: spacing.sm, textAlignVertical: 'top', borderRadius: cardRadii.compact, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.surface },
  closingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated },
  navRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
});
