import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import { ChevronLeft, Heart } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, type ImageSourcePropType, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Badge, HeroEntrance, IconButton } from '@/components/ui';
import type { KomuzTrack } from '@/features/culture/audioData';
import { KomuzPlaylist } from '@/features/culture/components';
import { resolveContentByDepth } from '@/services/ageExperience/contentDepth';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import type { SupportedLanguage } from '@/i18n';
import type { CultureItemRow } from '@/services/content/types';
import { favoriteKey, useFavoritesStore } from '@/store/useFavoritesStore';
import { colors, radii, shadows, spacing, typography } from '@/theme';

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
  const onToggleFavorite = () => void useFavoritesStore.getState().toggleFavorite('culture_item', item.id);

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
  const hasAudio = !!audioTracks && audioTracks.length > 0;

  // The primary photo (admin-uploaded image_url, falling back to the first
  // bundled image) becomes the cinematic hero; any remaining bundled images
  // still get their own browsable strip below, just no longer duplicated
  // with whichever one is already the hero.
  const heroSource: ImageSourcePropType | { uri: string } | null = item.image_url ? { uri: item.image_url } : (images?.[0] ?? null);
  const remainingImages = item.image_url ? images : images?.slice(1);
  const hasRemainingGallery = !!remainingImages && remainingImages.length > 0;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {heroSource ? (
          <HeroEntrance>
            <View style={styles.hero}>
              {item.image_url ? (
                // Storage-backed (admin-uploaded, see
                // admin_set_culture_item_image) - expo-image gives this one
                // real disk/memory caching, unlike the bundled images below
                // which are already local and don't need it.
                <ExpoImage source={heroSource as { uri: string }} style={styles.heroImage} contentFit="cover" cachePolicy="disk" />
              ) : (
                <Image source={heroSource as ImageSourcePropType} style={styles.heroImage} resizeMode="cover" />
              )}
              <LinearGradient colors={['rgba(19,32,24,0)', 'rgba(19,32,24,0.85)']} locations={[0.4, 1]} style={StyleSheet.absoluteFill} />

              <View style={styles.heroOverlay} pointerEvents="box-none">
                <View style={[styles.heroTopRow, { paddingTop: insets.top + spacing.sm }]}>
                  <IconButton icon={ChevronLeft} shape="roundedSquare" variant="surface" accessibilityLabel={t('settings.backLabel')} onPress={onPressBack} />
                  <IconButton
                    icon={Heart}
                    shape="roundedSquare"
                    variant={isFavorite ? 'primary' : 'surface'}
                    accessibilityLabel={isFavorite ? t('saved.removeLabel') : t('saved.saveLabel')}
                    onPress={onToggleFavorite}
                  />
                </View>
                <Text style={styles.heroTitle} numberOfLines={2}>
                  {item.title}
                </Text>
              </View>
            </View>
          </HeroEntrance>
        ) : (
          <View style={[styles.plainHeader, { paddingTop: insets.top + spacing.sm }]}>
            <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('settings.backLabel')} onPress={onPressBack} />
            <Text style={styles.plainHeaderTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <IconButton
              icon={Heart}
              shape="roundedSquare"
              variant={isFavorite ? 'primary' : 'surface'}
              accessibilityLabel={isFavorite ? t('saved.removeLabel') : t('saved.saveLabel')}
              onPress={onToggleFavorite}
            />
          </View>
        )}

        <View style={styles.contentBody}>
          <View style={styles.headerBlock}>
            {item.alt_names ? <Text style={styles.altNames}>{item.alt_names}</Text> : null}
            {item.type_label ? (
              <Badge label={t(`culture.item.type.${item.type_label}`)} color={colors.surfaceAlt} textColor={colors.primary} />
            ) : null}
            <Badge label={t(`culture.item.accuracy.${item.accuracy_level}`)} color={colors.surfaceAlt} textColor={colors.textSecondary} />
          </View>

          {hasRemainingGallery ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery}>
              {remainingImages!.map((source, index) => (
                <Image key={index} source={source} style={styles.galleryImage} resizeMode="cover" />
              ))}
            </ScrollView>
          ) : null}

          {hasAudio ? (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t('culture.item.tracksLabel')}</Text>
              <KomuzPlaylist tracks={audioTracks} />
            </View>
          ) : null}

          {simpleSummary ? (
            <View style={styles.field}>
              <Text style={styles.fieldValue}>{simpleSummary}</Text>
            </View>
          ) : filledFields.length === 0 ? (
            hasAudio ? null : <Text style={styles.pending}>{t('culture.item.pendingResearch')}</Text>
          ) : (
            <View style={styles.fields}>
              {filledFields.map((field) => (
                <View key={field.key} style={styles.field}>
                  <Text style={styles.fieldLabel}>{t(field.labelKey)}</Text>
                  <Text style={styles.fieldValue}>{item[field.key] as string}</Text>
                </View>
              ))}
            </View>
          )}

          {item.sources && item.sources.length > 0 ? (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t('culture.item.sourcesLabel')}</Text>
              {item.sources.map((url) => (
                <AnimatedPressable key={url} onPress={() => Linking.openURL(url)} accessibilityRole="link">
                  <Text style={styles.sourceLink} numberOfLines={1}>
                    {url}
                  </Text>
                </AnimatedPressable>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  // Owns sizing/overflow only - no padding here. Padding for the back
  // button/title lives on `heroOverlay` instead - see TodayDiscoveryCard's
  // `card`/`overlay` comment for why padding directly on this node would
  // make the absolute-fill image/gradient fall short of the true edge.
  hero: {
    width: '100%',
    aspectRatio: 1.5,
    borderBottomLeftRadius: radii.xxl,
    borderBottomRightRadius: radii.xxl,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  heroImage: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroTitle: {
    ...typography.display,
    color: colors.textOnDark,
  },
  plainHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  plainHeaderTitle: {
    ...typography.h1,
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  contentBody: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  headerBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  altNames: {
    ...typography.body,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  gallery: {
    gap: spacing.sm,
  },
  galleryImage: {
    width: 220,
    height: 160,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    ...shadows.card,
  },
  pending: {
    ...typography.body,
    color: colors.textSecondary,
  },
  fields: {
    gap: spacing.md,
  },
  field: {
    gap: spacing.xxs,
  },
  fieldLabel: {
    ...typography.overline,
    color: colors.textSecondary,
  },
  fieldValue: {
    ...typography.body,
    color: colors.textPrimary,
    lineHeight: 21,
  },
  sourceLink: {
    ...typography.small,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
});
