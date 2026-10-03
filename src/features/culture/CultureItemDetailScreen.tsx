import { useEffect, useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import { ChevronLeft, Heart, Share2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { KyrgyzOnlyNote } from '@/components/content/KyrgyzOnlyNote';
import { ReportIssueLink } from '@/components/content/ReportIssueLink';
import { SourcesAndNotes } from '@/components/content/SourcesAndNotes';
import { type ImageSourcePropType, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddToJournalButton } from '@/components/journal/AddToJournalButton';
import { AudioGuidePlayer } from '@/components/audio/AudioGuidePlayer';
import { AddToCollectionButton } from '@/features/myCollections/AddToCollection';
import { HeroEntrance, IconButton, MediaImage } from '@/components/ui';
import type { KomuzTrack } from '@/features/culture/audioData';
import { challengeCollectionFor, KomuzPlaylist, OymoDivider, RelatedItemsRail, TestKnowledgeLink } from '@/features/culture/components';
import { resolveContentByDepth } from '@/services/ageExperience/contentDepth';
import { ReadingActions, ReadingOverlay } from '@/features/culture/reading/ReadingChrome';
import { useReadingTracker } from '@/features/culture/reading/useReadingTracker';
import { ReaderButton, useReaderSettings } from '@/features/culture/reader/ReaderControls';
import { readerBodyStyle } from '@/features/culture/reader/readerSettings';
import { PassageActions } from '@/features/culture/highlights/PassageActions';
import { KeyTermsSection } from '@/features/culture/glossary/KeyTermsSection';
import { ThenAndNowSection } from '@/features/culture/thenNow/ThenAndNowSection';
import { thenNowRoute } from '@/features/culture/thenNow/thenAndNow';
import { cultureItemNarration, localizedSimpleSummary } from '@/services/audioGuide/contentNarration';
import type { Narration } from '@/services/audioGuide/narration';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import type { SupportedLanguage } from '@/i18n';
import type { CultureItemRow } from '@/services/content/types';
import { useShareCard } from '@/services/share/useShareCard';
import { favoriteKey, useFavoritesStore } from '@/store/useFavoritesStore';
import { cardRadii, colors, editorial, spacing, textStyles, typography } from '@/theme';
import { toggleFavoriteWithFeedback } from '@/features/saved/toggleFavoriteWithFeedback';
import { cultureItemNarrationParts, shouldAutoScroll } from './readListen/narrationSections';
import { ReadListenControls, readListenStyles, useReadListen } from './readListen/ReadListen';
import { useReducedMotion } from '@/services/motion/useReducedMotion';

type CultureItemDetailScreenProps = {
  item: CultureItemRow;
  images?: ImageSourcePropType[];
  audioTracks?: KomuzTrack[];
  /** Opened from Highlights: the section key to scroll near. */
  initialSection?: string;
  onPressBack: () => void;
};

/** The language the article's body text is actually in (Kyrgyz unless a
 * full reviewed translation is shown) - what a saved passage records. */
function bodyLanguageFor(item: CultureItemRow, appLanguage: string): string {
  return item.translation?.status === 'available' ? appLanguage : 'kg';
}

const DETAIL_FIELDS: { key: keyof CultureItemRow; labelKey: string }[] = [
  { key: 'origin', labelKey: 'culture.item.originLabel' },
  { key: 'history', labelKey: 'culture.item.historyLabel' },
  { key: 'cultural_meaning', labelKey: 'culture.item.culturalMeaningLabel' },
  { key: 'when_used', labelKey: 'culture.item.whenUsedLabel' },
  { key: 'ingredients', labelKey: 'culture.item.ingredientsLabel' },
  { key: 'traditional_method', labelKey: 'culture.item.traditionalMethodLabel' },
  { key: 'who_participates', labelKey: 'culture.item.whoParticipatesLabel' },
  { key: 'objects_used', labelKey: 'culture.item.objectsUsedLabel' },
  { key: 'regional_notes', labelKey: 'culture.item.regionalNotesLabel' },
  { key: 'modern_status', labelKey: 'culture.item.modernStatusLabel' },
  { key: 'fun_facts', labelKey: 'culture.item.funFactsLabel' },
];

export function CultureItemDetailScreen({ item, images, audioTracks, initialSection, onPressBack }: CultureItemDetailScreenProps) {
  const { t, i18n } = useTranslation();
  const { config, experience } = useAgeExperience();
  // Private reading progress (real scroll measurement; resume is offered).
  const reading = useReadingTracker('culture_item', item.id);
  // Reader controls (presentation only): body size/spacing + focus mode.
  // A change relays the text, so the reading RATIO is kept, not the pixels.
  const reader = useReaderSettings();
  const bodyStyle = readerBodyStyle(experience === 'child' ? 17 : 16, reader, experience === 'child');
  const readerChanged = useRef(false);
  useEffect(() => {
    if (!readerChanged.current) {
      readerChanged.current = true;
      return;
    }
    reading.keepPosition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reader.textSize, reader.lineSpacing, reader.focusMode]);
  // Opened from a saved highlight: scroll near that section once laid out
  // (anchored by section KEY, never by a stored pixel position).
  const sectionOffsets = useRef<Record<string, number>>({});
  const scrolledToSection = useRef(false);
  const scrollToInitialSection = () => {
    if (!initialSection || scrolledToSection.current) return;
    const { body, fields } = sectionOffsets.current;
    const field = sectionOffsets.current[initialSection];
    if (body === undefined || fields === undefined || field === undefined) return;
    scrolledToSection.current = true;
    reading.scrollRef.current?.scrollTo({ y: Math.max(0, body + fields + field - 24), animated: false });
  };
  const insets = useSafeAreaInsets();
  const isFavorite = useFavoritesStore((state) => state.favoriteIds.includes(favoriteKey('culture_item', item.id)));
  const onToggleFavorite = () => void toggleFavoriteWithFeedback('culture_item', item.id);
  const { share, shareHost } = useShareCard();

  // 'simple' depth (child/preteen) shows just the condensed summary when
  // one is stored (in the current language) for this item; 'standard'/
  // 'advanced' (teen/adult), or a 'simple' request with no summary stored
  // yet in this language, fall back to the full field-by-field breakdown
  // that's always been here (spec "Fallback safely to the standard version
  // when an age-specific version is unavailable").
  const simpleSummary = resolveContentByDepth(
    { simple: localizedSimpleSummary(item, i18n.language as SupportedLanguage) },
    config.learningDepth,
  );
  const filledFields = DETAIL_FIELDS.filter((field) => !!item[field.key]);

  // Listen reads exactly what this screen shows below (shared with the
  // Regional Audio Journeys): the simple summary (authored in the app
  // language) or the field texts in the language they're actually in.
  const narration: Narration = cultureItemNarration(item, i18n.language as SupportedLanguage, config.learningDepth);
  // Read & Listen: highlight the section device speech is reading (never for
  // recordings, which have no authored timing), optionally following it.
  const narrationParts = useMemo(() => cultureItemNarrationParts(item, i18n.language as SupportedLanguage, config.learningDepth), [item, i18n.language, config.learningDepth]);
  const listen = useReadListen(`culture_item:${item.id}`, narrationParts);
  const [readListen, setReadListen] = useState(false);
  const [follow, setFollow] = useState(true);
  const reducedMotion = useReducedMotion();
  const lastManualScroll = useRef<number | null>(null);
  const current = readListen ? listen.keys : [];
  const currentKey = current[0] ?? null;
  useEffect(() => {
    if (!currentKey || !shouldAutoScroll(follow, lastManualScroll.current, Date.now())) return;
    const { body, fields } = sectionOffsets.current;
    const field = currentKey === 'simple_summary' ? 0 : sectionOffsets.current[currentKey];
    if (body === undefined || field === undefined) return;
    reading.scrollRef.current?.scrollTo({ y: Math.max(0, body + (currentKey === 'simple_summary' ? (sectionOffsets.current.summary ?? 0) : (fields ?? 0) + field) - 80), animated: !reducedMotion });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentKey, follow]);
  const hasAudio = !!audioTracks && audioTracks.length > 0;

  // The primary photo (admin-uploaded image_url, falling back to the first
  // bundled image) becomes the cinematic hero; any remaining bundled images
  // still get their own browsable strip below, just no longer duplicated
  // with whichever one is already the hero.
  const heroSource: ImageSourcePropType | { uri: string } | null = item.image_url ? { uri: item.image_url } : (images?.[0] ?? null);
  const remainingImages = item.image_url ? images : images?.slice(1);
  const hasRemainingGallery = !!remainingImages && remainingImages.length > 0;

  function handleShare() {
    void share(
      { title: item.title, label: t('saved.contentTypes.culture_item'), imageSource: heroSource as ImageSourcePropType | null },
      t('share.message', { title: item.title }),
      { link: { type: 'culture_item', id: item.id, title: item.title } },
    );
  }

  const isChild = config.textComplexity === 'minimal';
  const challengeCollection = challengeCollectionFor(item.id);
  const typeLabel = item.type_label ? t(`culture.item.type.${item.type_label}`) : null;

  const actions = (
    <View style={styles.headerActions}>
      <ReaderButton isChild={isChild} elevated={!!heroSource} />
      <IconButton icon={Share2} size={40} iconSize={19} shape="roundedSquare" elevated={!!heroSource} accessibilityLabel={t('share.action')} onPress={handleShare} />
      <IconButton
        icon={Heart}
        size={40}
        iconSize={19}
        shape="roundedSquare"
        elevated={!!heroSource}
        variant={isFavorite ? 'primary' : 'surface'}
        accessibilityLabel={isFavorite ? t('saved.removeLabel') : t('saved.saveLabel')}
        onPress={onToggleFavorite}
      />
      <AddToCollectionButton contentType="culture_item" contentId={item.id} title={item.title} elevated={!!heroSource} />
    </View>
  );

  return (
    <View style={styles.root}>
      <ScrollView
        ref={reading.scrollRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onScroll={reading.onScroll}
        scrollEventThrottle={64}
        onContentSizeChange={reading.onContentSizeChange}
        onLayout={reading.onLayout}
        onScrollBeginDrag={() => (lastManualScroll.current = Date.now())}
      >
        {/* 1. Hero media - title sits on the photo (serif for teen/adult). */}
        {heroSource ? (
          <HeroEntrance>
            <View style={[styles.hero, isChild && styles.heroChild, reader.focusMode && styles.heroFocus]}>
              {item.image_url ? (
                // Storage-backed (admin-uploaded, see admin_set_culture_item_image).
                <ExpoImage source={heroSource as { uri: string }} style={styles.heroImage} contentFit="cover" cachePolicy="disk" transition={200} />
              ) : (
                <MediaImage source={heroSource as ImageSourcePropType} />
              )}
              <LinearGradient colors={[colors.scrimTop, colors.scrimClear, colors.scrimBottom]} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} />

              <View style={styles.heroOverlay} pointerEvents="box-none">
                <View style={[styles.heroTopRow, { paddingTop: insets.top + spacing.xs }]}>
                  <IconButton icon={ChevronLeft} size={40} iconSize={20} shape="roundedSquare" accessibilityLabel={t('settings.backLabel')} onPress={onPressBack} />
                  {actions}
                </View>
                <View style={styles.heroText}>
                  {typeLabel ? <Text style={styles.heroEyebrow}>{typeLabel}</Text> : null}
                  <Text style={[styles.heroTitle, !isChild && styles.heroTitleEditorial]} numberOfLines={3} accessibilityRole="header">
                    {item.title}
                  </Text>
                </View>
              </View>
            </View>
          </HeroEntrance>
        ) : (
          <View style={[styles.plainHeader, { paddingTop: insets.top + spacing.xs }]}>
            <View style={styles.plainTopRow}>
              <IconButton icon={ChevronLeft} size={40} iconSize={20} shape="roundedSquare" elevated={false} accessibilityLabel={t('settings.backLabel')} onPress={onPressBack} />
              {actions}
            </View>
            {typeLabel ? <Text style={styles.plainEyebrow}>{typeLabel}</Text> : null}
            <Text style={[styles.plainHeaderTitle, !isChild && styles.heroTitleEditorial]} accessibilityRole="header">
              {item.title}
            </Text>
          </View>
        )}

        <View style={styles.contentBody} onLayout={(event) => (sectionOffsets.current.body = event.nativeEvent.layout.y)}>
          {/* 2. Short context: alternative names. (Review state and sources
              live in the quiet "Sources & notes" row at the end.) */}
          {item.alt_names ? (
            <View style={styles.context}>
              <Text style={styles.altNames}>{item.alt_names}</Text>
            </View>
          ) : null}

          {simpleSummary ? null : <KyrgyzOnlyNote status={item.translation?.status} language={i18n.language} />}

          {/* 3. Compact audio guide, right where reading starts. */}
          <AudioGuidePlayer contentKey={`culture_item:${item.id}`} narration={narration} title={item.title} />
          {narration.lang === i18n.language && narration.text ? <ReadListenControls enabled={readListen} onToggle={setReadListen} follow={follow} onToggleFollow={setFollow} recorded={listen.recorded} /> : null}

          {/* 4. Content blocks - text straight on the page, no boxes. */}
          {simpleSummary ? (
            <View style={current.includes('simple_summary') ? readListenStyles.current : undefined} onLayout={(event) => (sectionOffsets.current.summary = event.nativeEvent.layout.y)}>
              <Text style={[styles.paragraph, isChild && styles.paragraphChild, bodyStyle]}>{simpleSummary}</Text>
            </View>
          ) : filledFields.length === 0 ? (
            hasAudio ? null : <Text style={styles.pending}>{t('culture.item.pendingResearch')}</Text>
          ) : (
            <View style={styles.fields} onLayout={(event) => (sectionOffsets.current.fields = event.nativeEvent.layout.y)}>
              {filledFields.map((field, index) => (
                <View
                  key={field.key}
                  style={[styles.field, current.includes(field.key as string) && readListenStyles.current]}
                  onLayout={(event) => {
                    sectionOffsets.current[field.key] = event.nativeEvent.layout.y;
                    scrollToInitialSection();
                  }}
                >
                  {index > 0 && !reader.focusMode ? <OymoDivider /> : null}
                  <Text style={styles.fieldLabel} accessibilityRole="header">
                    {t(field.labelKey)}
                  </Text>
                  <Text style={[styles.paragraph, isChild && styles.paragraphChild, bodyStyle]}>{item[field.key] as string}</Text>
                  {/* Save the WHOLE authored section (no fragile text selection). */}
                  <PassageActions
                    contentType="culture_item"
                    contentId={item.id}
                    sectionKey={field.key}
                    sectionLabel={t(field.labelKey)}
                    title={item.title}
                    text={item[field.key] as string}
                    language={bodyLanguageFor(item, i18n.language)}
                    simple={isChild}
                  />
                </View>
              ))}
            </View>
          )}

          {/* 4b. Then & Now - only when the item has real authored
              historical AND modern fields (derived, never stored). */}
          <ThenAndNowSection item={item} experience={experience} language={i18n.language} onPressOpen={() => router.push(thenNowRoute(item.id) as never)} />

          {/* Key terms: explicit glossary links for this article (no auto-linking). */}
          <KeyTermsSection itemId={item.id} />

          {/* 5. Relevant images. */}
          {/* Focus mode: the decorative gallery and related rail step back;
              body, sources, verification and Report stay. */}
          {hasRemainingGallery && !reader.focusMode ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery} style={styles.galleryBleed}>
              {remainingImages!.map((source, index) => (
                <View key={index} style={styles.galleryImage}>
                  <MediaImage source={source} />
                </View>
              ))}
            </ScrollView>
          ) : null}

          {hasAudio ? (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t('culture.item.tracksLabel')}</Text>
              <KomuzPlaylist tracks={audioTracks} />
            </View>
          ) : null}

          {/* 6. Save / Journal - secondary, after reading. */}
          <View style={styles.actionsRow}>
            <AddToJournalButton type="culture_item" id={item.id} title={item.title} />
          </View>
          <ReadingActions tracker={reading} />

          {challengeCollection ? <TestKnowledgeLink collection={challengeCollection} /> : null}

          <SourcesAndNotes contentType="culture_item" level={item.accuracy_level} sources={item.sources} />
          <ReportIssueLink contentType="culture_item" contentId={item.id} title={item.title} />
        </View>

        {/* 7. Related real items from the same category. */}
        {reader.focusMode ? null : <RelatedItemsRail item={item} />}
      </ScrollView>
      <ReadingOverlay tracker={reading} experience={experience} />
      {shareHost}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xxl, gap: spacing.lg },
  hero: { width: '100%', aspectRatio: 1.25, borderBottomLeftRadius: cardRadii.hero, borderBottomRightRadius: cardRadii.hero, overflow: 'hidden', backgroundColor: colors.surfaceFeature },
  heroChild: { aspectRatio: 1.05 },
  heroFocus: { aspectRatio: 2 },
  heroImage: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  heroOverlay: { ...StyleSheet.absoluteFill, width: '100%', height: '100%', justifyContent: 'space-between', padding: spacing.md, paddingBottom: spacing.lg },
  headerActions: { flexDirection: 'row', gap: spacing.xs },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between' },
  heroText: { gap: 4 },
  heroEyebrow: { ...textStyles.overline, color: colors.accentGold },
  heroTitle: { ...textStyles.display, color: colors.textOnDark },
  heroTitleEditorial: { ...editorial(textStyles.display) },
  plainHeader: { paddingHorizontal: spacing.md, gap: spacing.xs },
  plainTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  plainEyebrow: { ...textStyles.overline, color: colors.accentTerracotta },
  plainHeaderTitle: { ...textStyles.display, color: colors.textPrimary },
  contentBody: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  context: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  altNames: { ...textStyles.body, fontStyle: 'italic', color: colors.textSecondary, flexShrink: 1 },
  galleryBleed: { marginHorizontal: -spacing.lg },
  gallery: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  galleryImage: { width: 240, aspectRatio: 1.4, borderRadius: cardRadii.media, overflow: 'hidden', backgroundColor: colors.surfaceMuted },
  pending: { ...textStyles.body, color: colors.textSecondary },
  fields: { gap: spacing.md },
  field: { gap: spacing.xs },
  fieldLabel: { ...textStyles.overline, color: colors.accentTerracotta },
  paragraph: { ...textStyles.body, fontSize: 16, lineHeight: 25, color: colors.textPrimary },
  paragraphChild: { fontSize: 17, lineHeight: 26 },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  sourceLink: { ...typography.small, color: colors.primary, textDecorationLine: 'underline', minHeight: 32, paddingVertical: 8 },
});
