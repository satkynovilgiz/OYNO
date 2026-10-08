import { router } from 'expo-router';
import { ArrowDown, ArrowUp, Check, ChevronLeft, ChevronRight, ImageOff, Landmark, Share2 } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { contentTypeMeta } from '@/components/library/contentTypeMeta';
import { NotFoundState } from '@/components/system/NotFoundState';
import { AnimatedPressable, Button, IconButton, TextField, Toggle } from '@/components/ui';
import { announce } from '@/services/a11y/announce';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import type { CatalogContentType } from '@/services/content/contentCatalog';
import { useNetworkStatus } from '@/services/offline/networkStatus';
import { useShareCard } from '@/services/share/useShareCard';
import { ownerExhibition, useMyCollectionsStore } from '@/store/useMyCollectionsStore';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { useContentResolver, useMyCollections } from '../useMyCollections';
import { buildExhibitionCover, CAPTION_MAX, emptyExhibition, exhibitKey, INTRO_MAX, MAX_EXHIBITS, moveExhibit, normalizeExhibition, REFLECTION_PROMPTS, setCaption, setReflection, slidesFor, TITLE_MAX, toggleExhibit, type Exhibition, type ReflectionPromptId } from './museumModel';
import { LookCloselyPlay, LookCloselySetup } from './LookClosely';
import { endLookSession, resumeLookSession } from './lookCloselyModel';
import { VisitorTour } from './VisitorTour';

type Mode = 'setup' | 'present' | 'visit' | 'look';

/**
 * /profile/my-collections/museum?collection=<id> - present an existing
 * private collection as a small exhibition. Everything the owner writes
 * (title, introduction, captions) stays private on this device for this
 * owner; sharing is an explicit cover card whose preview is exactly what
 * is sent (no captions; the introduction only when switched on).
 */
export function MiniMuseumScreen({ collectionId, onPressBack }: { collectionId: string; onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const large = experience === 'child';
  const { data, owner, isLoaded } = useMyCollections();
  const museums = useMyCollectionsStore((state) => state.museums);
  const { resolve, ready } = useContentResolver();
  const { share, shareHost } = useShareCard();
  const { isOffline } = useNetworkStatus();
  // A Look Closely game in progress (in memory) resumes when the screen is re-created, e.g. after opening a source.
  const [mode, setMode] = useState<Mode>(() => (resumeLookSession(owner, collectionId) ? 'look' : 'setup'));
  const [slide, setSlide] = useState(0);
  const [includeIntro, setIncludeIntro] = useState(false);
  const collection = data.collections.find((candidate) => candidate.id === collectionId) ?? null;

  // The owner's saved exhibition, re-checked against the collection now (removed items drop out).
  const exhibition: Exhibition | null = useMemo(() => {
    if (!collection) return null;
    return normalizeExhibition(ownerExhibition(museums, owner, collectionId), data, collectionId) ?? emptyExhibition(collection, data, collectionId);
  }, [museums, owner, collectionId, data, collection]);

  useEffect(() => {
    // Another owner signed in: nothing of the previous presentation stays on screen.
    if (!resumeLookSession(owner, collectionId)) setMode('setup');
    setSlide(0);
    setIncludeIntro(false);
  }, [owner]);

  if (!isLoaded) return <View style={styles.root} />;
  if (!collection || !exhibition) return <NotFoundState onPressBack={onPressBack} />;

  const save = (next: Exhibition) => useMyCollectionsStore.getState().saveExhibition(owner, collectionId, { ...next, updatedAt: new Date().toISOString() });
  const items = data.items.filter((item) => item.collectionId === collectionId).sort((a, b) => a.sortOrder - b.sortOrder);
  const slides = slidesFor(exhibition, resolve, ready);
  const current = slides[Math.min(slide, slides.length - 1)];
  const titleOf = (key: string) => {
    const [type, ...rest] = key.split(':');
    return resolve(type, rest.join(':'))?.title ?? (ready ? t('myCollections.unavailable') : '…');
  };
  const firstArtwork = (slides.find((entry) => entry.kind === 'exhibit' && entry.content.thumbnail)?.kind === 'exhibit' ? (slides.find((entry) => entry.kind === 'exhibit' && entry.content.thumbnail) as Extract<(typeof slides)[number], { kind: 'exhibit' }>).content.thumbnail : null) as ImageSourcePropType | null;
  const exhibitionTitle = exhibition.title.trim() || collection.name;
  const cover = buildExhibitionCover({ title: exhibitionTitle, exhibitCountLabel: t('museum.exhibitCount', { count: exhibition.exhibits.length }), label: t('museum.label'), cover: firstArtwork, intro: includeIntro ? exhibition.intro : null });

  const go = (next: number) => {
    setSlide(next);
    announce(t('museum.exhibitOf', { current: next + 1, total: slides.length }));
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={mode === 'setup' ? onPressBack : () => { endLookSession(); setMode('setup'); }} />
        <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
          {mode === 'setup' ? t('museum.title') : exhibitionTitle}
        </Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]} keyboardShouldPersistTaps="handled">
        {mode === 'setup' ? (
          <View style={styles.stack} testID="museum-setup">
            <Text style={styles.meta}>{t('museum.intro')}</Text>
            <TextField testID="museum-title" label={t('museum.titleLabel')} value={exhibition.title} onChangeText={(value) => save({ ...exhibition, title: value.slice(0, TITLE_MAX) })} placeholder={collection.name} />
            <TextField testID="museum-intro" label={t('museum.introLabel')} value={exhibition.intro} onChangeText={(value) => save({ ...exhibition, intro: value.slice(0, INTRO_MAX) })} multiline numberOfLines={3} placeholder={t('museum.introPlaceholder')} />
            <Text style={styles.meta}>{t('museum.privateNote')}</Text>

            <Text style={styles.heading}>{t('museum.exhibitsTitle', { count: exhibition.exhibits.length, max: MAX_EXHIBITS })}</Text>
            {items.length === 0 ? <Text style={styles.body}>{t('museum.emptyCollection')}</Text> : null}
            {exhibition.exhibits.map((key, index) => (
              <View key={key} style={styles.exhibitRow} testID={`museum-exhibit-${index}`}>
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <Text style={[styles.body, styles.bold]} numberOfLines={2}>
                    {index + 1}. {titleOf(key)}
                  </Text>
                  <TextField testID={`museum-caption-${index}`} label={t('museum.captionLabel')} value={exhibition.captions[key] ?? ''} onChangeText={(value) => save(setCaption(exhibition, key, value.slice(0, CAPTION_MAX)))} placeholder={t('museum.captionPlaceholder')} />
                  {(() => {
                    // Cycle: none -> each authored prompt -> none.
                    const currentPrompt = exhibition.reflections?.[key] ?? null;
                    const order: (ReflectionPromptId | null)[] = [null, ...REFLECTION_PROMPTS];
                    const nextPrompt = order[(order.indexOf(currentPrompt) + 1) % order.length];
                    const promptText = currentPrompt ? t(`museum.visit.prompts.${currentPrompt}`) : t('museum.visit.none');
                    return (
                      <AnimatedPressable style={styles.reflectionPick} onPress={() => save(setReflection(exhibition, key, nextPrompt))} accessibilityRole="button" accessibilityLabel={t('museum.visit.setupReflectionA11y', { name: titleOf(key), prompt: promptText })} testID={`museum-reflection-${index}`}>
                        <Text style={styles.meta}>{t('museum.visit.setupReflection', { prompt: promptText })}</Text>
                      </AnimatedPressable>
                    );
                  })()}
                </View>
                <View style={styles.moveColumn}>
                  <IconButton icon={ArrowUp} size={36} iconSize={14} elevated={false} disabled={index === 0} accessibilityLabel={t('museum.moveUp', { name: titleOf(key) })} onPress={() => save(moveExhibit(exhibition, index, -1))} testID={`museum-up-${index}`} />
                  <IconButton icon={ArrowDown} size={36} iconSize={14} elevated={false} disabled={index === exhibition.exhibits.length - 1} accessibilityLabel={t('museum.moveDown', { name: titleOf(key) })} onPress={() => save(moveExhibit(exhibition, index, 1))} testID={`museum-down-${index}`} />
                </View>
              </View>
            ))}
            <Text style={styles.label}>{t('museum.chooseTitle')}</Text>
            {items.map((item) => {
              const key = exhibitKey(item);
              const chosen = exhibition.exhibits.includes(key);
              const full = !chosen && exhibition.exhibits.length >= MAX_EXHIBITS;
              return (
                <AnimatedPressable key={key} style={[styles.choice, chosen && styles.choiceOn, full && styles.choiceDisabled]} onPress={() => save(toggleExhibit(exhibition, key))} disabled={full} accessibilityRole="checkbox" accessibilityState={{ checked: chosen, disabled: full }} aria-checked={chosen} accessibilityLabel={titleOf(key)} testID={`museum-choose-${key}`}>
                  {chosen ? <Check size={16} color={colors.primary} strokeWidth={2.5} /> : <View style={styles.box} />}
                  <Text style={[styles.body, { flex: 1 }]} numberOfLines={2}>
                    {titleOf(key)}
                  </Text>
                </AnimatedPressable>
              );
            })}
            {exhibition.exhibits.length >= MAX_EXHIBITS ? <Text style={styles.meta}>{t('museum.limit', { max: MAX_EXHIBITS })}</Text> : null}
            <Button label={t('museum.present')} size="lg" onPress={() => { setSlide(0); setMode('present'); }} disabled={exhibition.exhibits.length === 0} testID="museum-present" />
            <Button label={t('museum.visit.startTour')} variant="secondary" accessibilityHint={t('museum.visit.startTourHint')} onPress={() => setMode('visit')} disabled={exhibition.exhibits.length === 0} testID="museum-visit" />
            <Text style={styles.meta}>{t('museum.visit.startTourHint')}</Text>

            <LookCloselySetup exhibition={exhibition} slides={slides} titleOf={titleOf} onChange={(lookClosely) => save({ ...exhibition, lookClosely })} onPlay={() => { endLookSession(); setMode('look'); }} />

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('museum.shareTitle')}</Text>
              <Text style={styles.meta}>{t('museum.shareBody')}</Text>
              <View style={styles.toggleRow}>
                <Text style={[styles.body, { flex: 1 }]}>{t('museum.includeIntro')}</Text>
                <Toggle value={includeIntro} onValueChange={setIncludeIntro} accessibilityLabel={t('museum.includeIntro')} disabled={!exhibition.intro.trim()} />
              </View>
              <Button label={t('museum.shareCover')} icon={<Share2 size={16} color={colors.primary} strokeWidth={2.25} />} variant="secondary" onPress={() => void share(cover, exhibitionTitle)} disabled={exhibition.exhibits.length === 0} testID="museum-share" />
            </View>
          </View>
        ) : null}

        {mode === 'look' ? <LookCloselyPlay exhibition={exhibition} slides={slides} owner={owner} collectionId={collectionId} onEnd={() => setMode('setup')} /> : null}

        {mode === 'visit' ? <VisitorTour exhibition={exhibition} title={exhibitionTitle} slides={slides} isOffline={isOffline} large={large} onEnd={() => setMode('setup')} /> : null}

        {mode === 'present' && current ? (
          <View style={styles.stack} testID="museum-present-view">
            <Text style={styles.meta} testID="museum-slide-of">
              {t('museum.exhibitOf', { current: slide + 1, total: slides.length })}
            </Text>
            {slide === 0 && exhibition.intro.trim() ? <Text style={[styles.body, styles.introText]}>{exhibition.intro}</Text> : null}
            {current.kind === 'exhibit' ? (
              <>
                {current.content.thumbnail ? (
                  <Image source={current.content.thumbnail as ImageSourcePropType} style={[styles.artwork, large && styles.artworkLarge]} resizeMode="cover" accessibilityLabel={current.content.title} />
                ) : (
                  <View style={styles.noArtwork} testID="museum-no-artwork">
                    <ImageOff size={22} color={colors.textMuted} strokeWidth={2} />
                    <Text style={styles.meta}>{t('museum.noArtwork')}</Text>
                  </View>
                )}
                <View style={styles.sourceBlock}>
                  <Text style={styles.sectionLabel}>{t('museum.fromOyno')}</Text>
                  <Text style={styles.typeLabel}>{t(contentTypeMeta(current.contentType as CatalogContentType).labelKey)}</Text>
                  <Text style={[styles.exhibitTitle, large && styles.exhibitTitleLarge]} testID="museum-slide-title">
                    {current.content.title}
                  </Text>
                  {current.content.route ? (
                    <AnimatedPressable style={styles.link} onPress={() => router.push(current.content.route as never)} accessibilityRole="link" accessibilityLabel={t('museum.openSource', { name: current.content.title })}>
                      <Text style={styles.linkText}>{t('museum.openSource', { name: current.content.title })}</Text>
                      <ChevronRight size={14} color={colors.primary} strokeWidth={2} />
                    </AnimatedPressable>
                  ) : null}
                </View>
              </>
            ) : current.kind === 'removed' ? (
              <View style={styles.noArtwork} testID="museum-removed">
                <Landmark size={22} color={colors.textMuted} strokeWidth={2} />
                <Text style={styles.body}>{t('museum.removed')}</Text>
              </View>
            ) : (
              <Text style={styles.meta}>{t('museum.loading')}</Text>
            )}
            {/* The owner's own words - shown apart from what OYNO's content says. */}
            {current.kind !== 'loading' && current.caption ? (
              <View style={styles.captionBlock} testID="museum-slide-caption">
                <Text style={styles.sectionLabel}>{t('museum.yourCaption')}</Text>
                <Text style={[styles.body, large && styles.bodyLarge]}>{current.caption}</Text>
              </View>
            ) : null}
            <View style={styles.navRow}>
              <Button label={t('museum.previous')} variant="secondary" onPress={() => go(slide - 1)} disabled={slide === 0} testID="museum-prev" />
              {slide < slides.length - 1 ? <Button label={t('museum.next')} onPress={() => go(slide + 1)} testID="museum-next" /> : <Button label={t('museum.finish')} onPress={() => setMode('setup')} testID="museum-finish" />}
            </View>
          </View>
        ) : null}
      </ScrollView>
      {shareHost}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  content: { paddingHorizontal: spacing.md, gap: spacing.md },
  stack: { gap: spacing.sm },
  heading: { ...typography.h2, color: colors.textPrimary, marginTop: spacing.sm },
  label: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary, marginTop: spacing.sm },
  body: { ...textStyles.body, color: colors.textPrimary },
  bodyLarge: { fontSize: 19, lineHeight: 27 },
  bold: { fontWeight: '700' },
  meta: { ...textStyles.small, color: colors.textSecondary },
  exhibitRow: { flexDirection: 'row', gap: spacing.xs, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  moveColumn: { gap: spacing.xs },
  choice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48, paddingHorizontal: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1.5, borderColor: colors.borderSubtle },
  choiceOn: { borderColor: colors.primary },
  choiceDisabled: { opacity: 0.55 },
  box: { width: 16, height: 16, borderRadius: 4, borderWidth: 1.5, borderColor: colors.textSecondary },
  card: { gap: spacing.xs, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle, marginTop: spacing.sm },
  cardTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  introText: { fontStyle: 'italic', color: colors.textSecondary },
  artwork: { width: '100%', aspectRatio: 4 / 3, borderRadius: cardRadii.media, backgroundColor: colors.surfaceMuted },
  artworkLarge: { aspectRatio: 1 },
  noArtwork: { width: '100%', aspectRatio: 4 / 3, borderRadius: cardRadii.media, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', gap: spacing.xs, padding: spacing.md },
  sourceBlock: { gap: 2 },
  sectionLabel: { ...textStyles.overline, color: colors.primary },
  typeLabel: { ...textStyles.small, color: colors.textSecondary },
  exhibitTitle: { ...typography.h2, color: colors.textPrimary },
  exhibitTitleLarge: { fontSize: 26, lineHeight: 34 },
  captionBlock: { gap: 2, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceAlt, borderLeftWidth: 3, borderLeftColor: colors.primary },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, alignSelf: 'flex-start' },
  linkText: { ...textStyles.small, fontWeight: '700', color: colors.primary },
  navRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  reflectionPick: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: cardRadii.compact, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.borderSubtle },
});
