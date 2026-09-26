import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import { ChevronLeft, Heart, Share2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { KyrgyzOnlyNote } from '@/components/content/KyrgyzOnlyNote';
import { SourcesAndNotes } from '@/components/content/SourcesAndNotes';
import { type ImageSourcePropType, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddToJournalButton } from '@/components/journal/AddToJournalButton';
import { AudioGuidePlayer } from '@/components/audio/AudioGuidePlayer';
import { HeroEntrance, IconButton, MediaImage } from '@/components/ui';
import type { KomuzTrack } from '@/features/culture/audioData';
import { challengeCollectionFor, KomuzPlaylist, OymoDivider, RelatedItemsRail, TestKnowledgeLink } from '@/features/culture/components';
import { resolveContentByDepth } from '@/services/ageExperience/contentDepth';
import { joinNarration, type Narration } from '@/services/audioGuide/narration';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import type { SupportedLanguage } from '@/i18n';
import type { CultureItemRow } from '@/services/content/types';
import { useShareCard } from '@/services/share/useShareCard';
import { favoriteKey, useFavoritesStore } from '@/store/useFavoritesStore';
import { cardRadii, colors, editorial, spacing, textStyles, typography } from '@/theme';
import { toggleFavoriteWithFeedback } from '@/features/saved/toggleFavoriteWithFeedback';

/** Picks the simple-depth summary matching the app's current language -
 * `_ru`/`_en` stay null until a real translation is authored (spec "Do not
 * fake translations if verified/localized text does not exist"), so most
 * rows only ever resolve a value here for `kg`. */
function localizedSimpleSummary(item: CultureItemRow, language: SupportedLanguage): string | null {
  if (language === 'ru') return item.simple_summary_ru;
  if (language === 'en') return item.simple_summary_en;
  return item.simple_summary_kg;
}

type CultureItemDetailScreenProps = {
  item: CultureItemRow;
  images?: ImageSourcePropType[];
  audioTracks?: KomuzTrack[];
  onPressBack: () => void;
};

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

export function CultureItemDetailScreen({ item, images, audioTracks, onPressBack }: CultureItemDetailScreenProps) {
  const { t, i18n } = useTranslation();
  const { config } = useAgeExperience();
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

  // Listen reads exactly what this screen shows below: the simple summary
  // (authored in the app language) or the Kyrgyz-authored field texts.
  // Field text is in the app language only when the resolver found a full
  // reviewed translation; otherwise it is the Kyrgyz source (read with the
  // Kyrgyz title, so one narration never mixes languages).
  const bodyLanguage: SupportedLanguage = item.translation?.status === 'available' ? (i18n.language as SupportedLanguage) : 'kg';
  const narration: Narration = simpleSummary
    ? { lang: i18n.language as SupportedLanguage, text: joinNarration([item.title, simpleSummary]) }
    : { lang: bodyLanguage, text: joinNarration([bodyLanguage === 'kg' ? (item.translation?.titles.kg ?? item.title) : item.title, ...filledFields.map((field) => item[field.key] as string)]) };
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
    );
  }

  const isChild = config.textComplexity === 'minimal';
  const challengeCollection = challengeCollectionFor(item.id);
  const typeLabel = item.type_label ? t(`culture.item.type.${item.type_label}`) : null;

  const actions = (
    <View style={styles.headerActions}>
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
    </View>
  );

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* 1. Hero media - title sits on the photo (serif for teen/adult). */}
        {heroSource ? (
          <HeroEntrance>
            <View style={[styles.hero, isChild && styles.heroChild]}>
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

        <View style={styles.contentBody}>
          {/* 2. Short context: alternative names. (Review state and sources
              live in the quiet "Sources & notes" row at the end.) */}
          {item.alt_names ? (
            <View style={styles.context}>
              <Text style={styles.altNames}>{item.alt_names}</Text>
            </View>
          ) : null}

          {simpleSummary ? null : <KyrgyzOnlyNote status={item.translation?.status} language={i18n.language} />}

          {/* 3. Compact audio guide, right where reading starts. */}
          <AudioGuidePlayer contentKey={`culture_item:${item.id}`} narration={narration} />

          {/* 4. Content blocks - text straight on the page, no boxes. */}
          {simpleSummary ? (
            <Text style={[styles.paragraph, isChild && styles.paragraphChild]}>{simpleSummary}</Text>
          ) : filledFields.length === 0 ? (
            hasAudio ? null : <Text style={styles.pending}>{t('culture.item.pendingResearch')}</Text>
          ) : (
            <View style={styles.fields}>
              {filledFields.map((field, index) => (
                <View key={field.key} style={styles.field}>
                  {index > 0 ? <OymoDivider /> : null}
                  <Text style={styles.fieldLabel} accessibilityRole="header">
                    {t(field.labelKey)}
                  </Text>
                  <Text style={[styles.paragraph, isChild && styles.paragraphChild]}>{item[field.key] as string}</Text>
                </View>
              ))}
            </View>
          )}

          {/* 5. Relevant images. */}
          {hasRemainingGallery ? (
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

          {challengeCollection ? <TestKnowledgeLink collection={challengeCollection} /> : null}

          <SourcesAndNotes contentType="culture_item" level={item.accuracy_level} sources={item.sources} />
        </View>

        {/* 7. Related real items from the same category. */}
        <RelatedItemsRail item={item} />
      </ScrollView>
      {shareHost}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xxl, gap: spacing.lg },
  hero: { width: '100%', aspectRatio: 1.25, borderBottomLeftRadius: cardRadii.hero, borderBottomRightRadius: cardRadii.hero, overflow: 'hidden', backgroundColor: colors.surfaceFeature },
  heroChild: { aspectRatio: 1.05 },
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
