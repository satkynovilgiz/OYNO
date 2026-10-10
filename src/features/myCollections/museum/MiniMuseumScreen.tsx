import { router } from 'expo-router';
import { ArrowDown, ArrowUp, Check, ChevronLeft, ChevronRight, Eye, ImageOff, Landmark, Mic, Share2 } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { StoryPresent, StorySetup } from './StoryCards';
import { endStoryPlace, resumeStoryPlace } from './storyModel';
import { endLookSession, resumeLookSession } from './lookCloselyModel';
import { VisitorTour } from './VisitorTour';
import { NarrationEditor, NarrationPlayback, type CommitNarrations } from './Narration';
import { referencedAudio } from './narrationModel';
import { endPreview, keepPreview, PREVIEW_STARTS, readiness, resumePreview, startAvailability, type EditTarget, type PreviewStart, type ReadinessItem } from './previewModel';
import { sweepNarrations } from '@/services/museum/narrationAudio';
import { stopNarration } from '@/services/museum/narrationPlayer';

type Mode = 'setup' | 'present' | 'visit' | 'look' | 'story' | 'previewStart' | 'preview';

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
  const [mode, setMode] = useState<Mode>(() => {
    const preview = resumePreview(owner, collectionId);
    if (preview) return preview.view ? 'preview' : 'previewStart';
    return resumeLookSession(owner, collectionId) ? 'look' : resumeStoryPlace(owner, collectionId) ? 'story' : 'setup';
  });
  const [slide, setSlide] = useState(0);
  const [includeIntro, setIncludeIntro] = useState(false);
  /** Visitor Preview: which real visitor view is shown; where editing was, to return to it. */
  const [previewView, setPreviewView] = useState<PreviewStart>(() => resumePreview(owner, collectionId)?.view ?? 'exhibition');
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const editY = useRef(resumePreview(owner, collectionId)?.editY ?? 0);
  const pendingScroll = useRef<number | null>(null);
  const positions = useRef<Record<string, number>>({});
  /** The exhibit whose narration editor is open (one at a time). */
  const [narrating, setNarrating] = useState<string | null>(null);
  const collection = data.collections.find((candidate) => candidate.id === collectionId) ?? null;

  // The owner's saved exhibition, re-checked against the collection now (removed items drop out).
  const exhibition: Exhibition | null = useMemo(() => {
    if (!collection) return null;
    return normalizeExhibition(ownerExhibition(museums, owner, collectionId), data, collectionId) ?? emptyExhibition(collection, data, collectionId);
  }, [museums, owner, collectionId, data, collection]);

  useEffect(() => {
    // Another owner signed in: nothing of the previous presentation stays on screen.
    if (!resumeLookSession(owner, collectionId) && !resumeStoryPlace(owner, collectionId) && !resumePreview(owner, collectionId)) setMode('setup');
    setSlide(0);
    setIncludeIntro(false);
    setNarrating(null);
    // Another account never hears the previous one's narration.
    stopNarration();
  }, [owner]);

  // Narration plays only while the exhibition is open, and stops when the view changes.
  useEffect(() => stopNarration(), [mode]);
  useEffect(() => () => stopNarration(), []);

  // Recordings this owner's exhibitions no longer reference (a failed delete, a removed item) are cleared.
  useEffect(() => {
    if (!isLoaded) return;
    void sweepNarrations(owner, referencedAudio(useMyCollectionsStore.getState().museums[owner])).catch(() => undefined);
  }, [isLoaded, owner]);

  if (!isLoaded) return <View style={styles.root} />;
  if (!collection || !exhibition) return <NotFoundState onPressBack={onPressBack} />;

  const save = (next: Exhibition) => useMyCollectionsStore.getState().saveExhibition(owner, collectionId, { ...next, updatedAt: new Date().toISOString() });
  // Narration changes can finish after other edits (a recording being saved): always apply them to the LATEST exhibition.
  const commitNarrations: CommitNarrations = (change) => {
    const latest = normalizeExhibition(ownerExhibition(useMyCollectionsStore.getState().museums, owner, collectionId), data, collectionId) ?? exhibition;
    save({ ...latest, narrations: change(latest.narrations ?? {}) });
  };
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

  const inPreview = mode === 'preview' || mode === 'previewStart';
  const restoreScroll = () => {
    if (pendingScroll.current === null) return;
    scrollRef.current?.scrollTo({ y: pendingScroll.current, animated: false });
    pendingScroll.current = null;
  };
  const enterPreview = () => {
    editY.current = scrollY.current;
    keepPreview(owner, collectionId, null, editY.current);
    setMode('previewStart');
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };
  const startPreview = (view: PreviewStart) => {
    endStoryPlace();
    setSlide(0);
    setPreviewView(view);
    keepPreview(owner, collectionId, view, editY.current);
    setMode('preview');
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };
  /** Back to editing: where the curator was, or the place a checklist item points at. */
  const targetY = (target: EditTarget) => {
    const setupY = positions.current.setup ?? 0;
    const at = target.kind === 'exhibit' ? positions.current[`exhibit:${target.index}`] : target.kind === 'story' ? positions.current.story : positions.current.exhibits;
    return Math.max(0, setupY + (at ?? 0) - spacing.md);
  };
  const returnToEditing = (target?: EditTarget) => {
    endStoryPlace();
    endPreview();
    pendingScroll.current = target ? targetY(target) : editY.current;
    setMode('setup');
    requestAnimationFrame(restoreScroll);
  };
  const checklistText = (item: ReadinessItem) => {
    switch (item.id) {
      case 'noExhibits':
        return t('museum.preview.items.noExhibits');
      case 'unavailable':
        return t('museum.preview.items.unavailable', { n: item.index + 1 });
      case 'noImage':
        return t('museum.preview.items.noImage', { n: item.index + 1, name: titleOf(item.key) });
      case 'storyTooShort':
        return t('museum.preview.items.storyTooShort', { count: item.count, min: 3 });
      case 'storyUnavailable':
        return t('museum.preview.items.storyUnavailable', { n: item.index + 1 });
      case 'storyShortened':
        return t('museum.preview.items.storyShortened', { n: item.index + 1 });
    }
  };

  const go = (next: number) => {
    setSlide(next);
    announce(t('museum.exhibitOf', { current: next + 1, total: slides.length }));
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={mode === 'setup' ? onPressBack : inPreview ? () => returnToEditing() : () => { endLookSession(); endStoryPlace(); setMode('setup'); }} />
        <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
          {mode === 'setup' ? t('museum.title') : exhibitionTitle}
        </Text>
      </View>
      {inPreview ? (
        <View style={styles.previewBanner} accessibilityRole="summary" testID="preview-banner">
          <Eye size={16} color={colors.textOnPrimary} strokeWidth={2.25} />
          <Text style={styles.previewBannerText}>{t('museum.preview.banner')}</Text>
          <Button label={t('museum.preview.return')} variant="secondary" size="sm" onPress={() => returnToEditing()} testID="preview-return" />
        </View>
      ) : null}
      <ScrollView
        ref={scrollRef}
        testID="museum-scroll"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={32}
        onScroll={(event) => {
          if (mode === 'setup') scrollY.current = event.nativeEvent.contentOffset.y;
        }}
        onContentSizeChange={() => {
          if (mode === 'setup') restoreScroll();
        }}
      >
        {mode === 'setup' ? (
          <View style={styles.stack} testID="museum-setup" onLayout={(event) => (positions.current.setup = event.nativeEvent.layout.y)}>
            <Text style={styles.meta}>{t('museum.intro')}</Text>
            <TextField testID="museum-title" label={t('museum.titleLabel')} value={exhibition.title} onChangeText={(value) => save({ ...exhibition, title: value.slice(0, TITLE_MAX) })} placeholder={collection.name} />
            <TextField testID="museum-intro" label={t('museum.introLabel')} value={exhibition.intro} onChangeText={(value) => save({ ...exhibition, intro: value.slice(0, INTRO_MAX) })} multiline numberOfLines={3} placeholder={t('museum.introPlaceholder')} />
            <Text style={styles.meta}>{t('museum.privateNote')}</Text>

            <Text style={styles.heading} onLayout={(event) => (positions.current.exhibits = event.nativeEvent.layout.y)}>
              {t('museum.exhibitsTitle', { count: exhibition.exhibits.length, max: MAX_EXHIBITS })}
            </Text>
            {items.length === 0 ? <Text style={styles.body}>{t('museum.emptyCollection')}</Text> : null}
            {exhibition.exhibits.map((key, index) => (
              <View key={key} style={styles.exhibitRow} testID={`museum-exhibit-${index}`} onLayout={(event) => (positions.current[`exhibit:${index}`] = event.nativeEvent.layout.y)}>
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
                  {(() => {
                    const narration = exhibition.narrations?.[key] ?? null;
                    const open = narrating === key;
                    const status = narration?.audioId ? t('museum.narration.statusRecorded') : narration?.text.trim() ? t('museum.narration.statusWritten') : t('museum.narration.statusNone');
                    return (
                      <>
                        <AnimatedPressable style={styles.reflectionPick} onPress={() => setNarrating(open ? null : key)} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={t('museum.narration.toggleA11y', { name: titleOf(key), status })} testID={`museum-narration-${index}`}>
                          <View style={styles.inlineRow}>
                            <Mic size={14} color={colors.textSecondary} strokeWidth={2} />
                            <Text style={styles.meta}>{t('museum.narration.toggle', { status })}</Text>
                          </View>
                        </AnimatedPressable>
                        {open ? <NarrationEditor key={`${owner}:${key}`} owner={owner} exhibitKey={key} title={titleOf(key)} narration={narration} commit={commitNarrations} /> : null}
                      </>
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

            <Button label={t('museum.preview.entry')} icon={<Eye size={16} color={colors.primary} strokeWidth={2.25} />} variant="secondary" accessibilityHint={t('museum.preview.entryHint')} onPress={enterPreview} testID="museum-preview" />
            <Text style={styles.meta}>{t('museum.preview.entryHint')}</Text>

            <View onLayout={(event) => (positions.current.story = event.nativeEvent.layout.y)}>
              <StorySetup exhibition={exhibition} slides={slides} titleOf={titleOf} onChange={(story) => save({ ...exhibition, story })} onPresent={() => { endStoryPlace(); setMode('story'); }} />
            </View>

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

        {mode === 'previewStart' ? (
          <View style={styles.stack} testID="preview-start">
            <Text style={styles.heading} accessibilityRole="header">
              {t('museum.preview.title')}
            </Text>
            <Text style={styles.meta}>{t('museum.preview.intro')}</Text>
            {PREVIEW_STARTS.map((view) => {
              const availability = startAvailability(exhibition)[view];
              return (
                <View key={view} style={styles.stack}>
                  <Button label={t(`museum.preview.start.${view}`)} variant={view === 'exhibition' ? 'primary' : 'secondary'} disabled={availability !== 'ok'} onPress={() => startPreview(view)} testID={`preview-start-${view}`} />
                  {availability !== 'ok' ? <Text style={styles.meta}>{t(`museum.preview.unavailable.${availability}`, { min: 3 })}</Text> : null}
                </View>
              );
            })}
            <Text style={styles.heading} accessibilityRole="header">
              {t('museum.preview.checklistTitle')}
            </Text>
            {(() => {
              const items = readiness(exhibition, slides, ready);
              return (
                <View style={styles.stack} testID="preview-checklist">
                  {!ready ? <Text style={styles.meta}>{t('museum.preview.checking')}</Text> : null}
                  {ready && items.length === 0 ? <Text style={styles.body} testID="preview-checklist-clear">{t('museum.preview.allClear')}</Text> : null}
                  {items.map((item, position) => (
                    <AnimatedPressable key={`${item.id}-${position}`} style={[styles.checkItem, item.severity === 'info' && styles.checkItemInfo]} onPress={() => returnToEditing(item.target)} accessibilityRole="button" accessibilityLabel={`${checklistText(item)} ${t('museum.preview.goEdit')}`} testID={`preview-item-${item.id}-${position}`}>
                      <Text style={styles.body}>{checklistText(item)}</Text>
                      <Text style={styles.linkText}>{t('museum.preview.goEdit')}</Text>
                    </AnimatedPressable>
                  ))}
                  <Text style={styles.meta}>{t('museum.preview.optionalNote')}</Text>
                </View>
              );
            })()}
          </View>
        ) : null}

        {mode === 'preview' && previewView === 'story' ? <StoryPresent preview exhibition={exhibition} slides={slides} owner={owner} collectionId={collectionId} storyTitle={exhibitionTitle} large={large} onShare={() => undefined} onEnd={() => { keepPreview(owner, collectionId, null, editY.current); setMode('previewStart'); }} /> : null}

        {mode === 'story' ? <StoryPresent exhibition={exhibition} slides={slides} owner={owner} collectionId={collectionId} storyTitle={exhibitionTitle} large={large} onShare={(content, fallback) => void share(content, fallback)} onEnd={() => setMode('setup')} /> : null}

        {mode === 'look' ? <LookCloselyPlay exhibition={exhibition} slides={slides} owner={owner} collectionId={collectionId} onEnd={() => setMode('setup')} /> : null}

        {mode === 'visit' || (mode === 'preview' && previewView === 'tour') ? <VisitorTour exhibition={exhibition} title={exhibitionTitle} slides={slides} isOffline={isOffline} large={large} owner={owner} onEnd={() => { if (mode === 'preview') keepPreview(owner, collectionId, null, editY.current); setMode(mode === 'preview' ? 'previewStart' : 'setup'); }} /> : null}

        {(mode === 'present' || (mode === 'preview' && previewView === 'exhibition')) && current ? (
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
                    <AnimatedPressable style={styles.link} onPress={() => router.push(current.content.route as never)} accessibilityRole="link" accessibilityLabel={t('museum.openSource', { name: current.content.title })} testID="museum-source-link">
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
            {current.kind !== 'loading' ? <NarrationPlayback key={`${owner}:${current.key}`} owner={owner} narration={exhibition.narrations?.[current.key]} big={large} /> : null}
            <View style={styles.navRow}>
              <Button label={t('museum.previous')} variant="secondary" onPress={() => go(slide - 1)} disabled={slide === 0} testID="museum-prev" />
              {slide < slides.length - 1 ? <Button label={t('museum.next')} onPress={() => go(slide + 1)} testID="museum-next" /> : <Button label={t('museum.finish')} onPress={() => { if (mode === 'preview') keepPreview(owner, collectionId, null, editY.current); setMode(mode === 'preview' ? 'previewStart' : 'setup'); }} testID="museum-finish" />}
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
  previewBanner: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, backgroundColor: colors.surfaceFeature },
  previewBannerText: { ...textStyles.small, fontWeight: '700', color: colors.textOnDark, flex: 1, minWidth: 160 },
  checkItem: { gap: 2, minHeight: 48, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.accentTerracotta, borderLeftWidth: 4 },
  checkItemInfo: { borderColor: colors.borderSubtle },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  reflectionPick: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: cardRadii.compact, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.borderSubtle },
});
