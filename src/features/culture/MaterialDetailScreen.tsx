import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import { ChevronLeft, Heart } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { KyrgyzOnlyNote } from '@/components/content/KyrgyzOnlyNote';
import { ReportIssueLink } from '@/components/content/ReportIssueLink';
import { SourcesAndNotes } from '@/components/content/SourcesAndNotes';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AudioGuidePlayer } from '@/components/audio/AudioGuidePlayer';
import { Badge, HeroEntrance, IconButton } from '@/components/ui';
import { AddToCollectionButton } from '@/features/myCollections/AddToCollection';
import { track } from '@/services/analytics/analytics';
import type { SupportedLanguage } from '@/i18n';
import { materialNarration } from '@/services/audioGuide/contentNarration';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { ReadingActions, ReadingOverlay } from '@/features/culture/reading/ReadingChrome';
import { useReadingTracker } from '@/features/culture/reading/useReadingTracker';
import { PassageActions } from '@/features/culture/highlights/PassageActions';
import { ReaderButton, useReaderSettings } from '@/features/culture/reader/ReaderControls';
import { readerBodyStyle } from '@/features/culture/reader/readerSettings';
import type { CultureMaterialRow } from '@/services/content/types';
import { favoriteKey, useFavoritesStore } from '@/store/useFavoritesStore';
import { colors, radii, spacing, typography } from '@/theme';
import { toggleFavoriteWithFeedback } from '@/features/saved/toggleFavoriteWithFeedback';
import { materialNarrationParts } from './readListen/narrationSections';
import { ReadListenControls, readListenStyles, useReadListen } from './readListen/ReadListen';

type MaterialDetailScreenProps = {
  material: CultureMaterialRow;
  onPressBack: () => void;
};

/** Modeled directly on CultureItemDetailScreen - same accuracy badge,
 * hero-image, sources-list, and "pending research" fallback pattern, for
 * culture_materials rows instead of culture_items rows (the two content
 * tables aren't unified - see the audit's note on why). */
export function MaterialDetailScreen({ material, onPressBack }: MaterialDetailScreenProps) {
  const { t, i18n } = useTranslation();
  // Body is in the app language only when fully translated; else Kyrgyz.
  const insets = useSafeAreaInsets();
  const isFavorite = useFavoritesStore((state) => state.favoriteIds.includes(favoriteKey('culture_material', material.id)));
  const onToggleFavorite = () => void toggleFavoriteWithFeedback('culture_material', material.id);
  const { experience } = useAgeExperience();
  // Private reading progress (real scroll measurement; resume is offered).
  const reading = useReadingTracker('culture_material', material.id);
  // Reader controls (presentation only); a change keeps the reading RATIO.
  const reader = useReaderSettings();
  const bodyStyle = readerBodyStyle(typography.body.fontSize, reader, experience === 'child');
  const readerChanged = useRef(false);
  useEffect(() => {
    if (!readerChanged.current) {
      readerChanged.current = true;
      return;
    }
    reading.keepPosition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reader.textSize, reader.lineSpacing, reader.focusMode]);

  // Read & Listen (one authored section here: the body). No follow-scroll:
  // a single section has nothing to move between.
  const narrationParts = useMemo(() => materialNarrationParts(material, i18n.language as SupportedLanguage), [material, i18n.language]);
  const listen = useReadListen(`culture_material:${material.id}`, narrationParts);
  const [readListen, setReadListen] = useState(false);
  const bodyNow = readListen && listen.keys.includes('body');

  useEffect(() => {
    track('culture_material_open', { materialId: material.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      >
        {material.image_url ? (
          <HeroEntrance>
            <View style={[styles.hero, reader.focusMode && styles.heroFocus]}>
              <ExpoImage source={{ uri: material.image_url }} style={styles.heroImage} contentFit="cover" cachePolicy="disk" />
              <LinearGradient colors={['rgba(19,32,24,0)', 'rgba(19,32,24,0.85)']} locations={[0.4, 1]} style={StyleSheet.absoluteFill} />

              <View style={styles.heroOverlay} pointerEvents="box-none">
                <View style={[styles.heroTopRow, { paddingTop: insets.top + spacing.sm }]}>
                  <IconButton icon={ChevronLeft} shape="roundedSquare" variant="surface" accessibilityLabel={t('settings.backLabel')} onPress={onPressBack} />
                  <View style={styles.headerButtons}>
                    <IconButton
                      icon={Heart}
                      shape="roundedSquare"
                      variant={isFavorite ? 'primary' : 'surface'}
                      accessibilityLabel={isFavorite ? t('saved.removeLabel') : t('saved.saveLabel')}
                      onPress={onToggleFavorite}
                    />
                    <AddToCollectionButton contentType="culture_material" contentId={material.id} title={material.title} />
            <ReaderButton isChild={experience === 'child'} />
                    <ReaderButton isChild={experience === 'child'} elevated />
                  </View>
                </View>
                <Text style={styles.heroTitle} numberOfLines={2}>
                  {material.title}
                </Text>
              </View>
            </View>
          </HeroEntrance>
        ) : (
          <View style={[styles.plainHeader, { paddingTop: insets.top + spacing.sm }]}>
            <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('settings.backLabel')} onPress={onPressBack} />
            <Text style={styles.plainHeaderTitle} numberOfLines={1}>
              {material.title}
            </Text>
            <IconButton
              icon={Heart}
              shape="roundedSquare"
              variant={isFavorite ? 'primary' : 'surface'}
              accessibilityLabel={isFavorite ? t('saved.removeLabel') : t('saved.saveLabel')}
              onPress={onToggleFavorite}
            />
            <AddToCollectionButton contentType="culture_material" contentId={material.id} title={material.title} />
          </View>
        )}

        <View style={styles.contentBody}>
          <View style={styles.headerBlock}>
            <Badge label={t(`culture.materials.types.${material.kind}`)} color={colors.surfaceAlt} textColor={colors.primary} />
          </View>

          <KyrgyzOnlyNote status={material.translation?.status} language={i18n.language} />
          {material.body ? (
            <AudioGuidePlayer
              contentKey={`culture_material:${material.id}`}
              title={material.title}
              narration={materialNarration(material, i18n.language as SupportedLanguage)}
            />
          ) : null}
          {material.body && materialNarration(material, i18n.language as SupportedLanguage)?.lang === i18n.language ? (
            <ReadListenControls enabled={readListen} onToggle={setReadListen} follow={false} onToggleFollow={() => undefined} recorded={listen.recorded} showFollow={false} />
          ) : null}

          {material.body ? (
            <View style={{ gap: spacing.xs }}>
              <View style={bodyNow ? readListenStyles.current : undefined}>
                <Text style={[styles.body, bodyStyle]}>{material.body}</Text>
              </View>
              <PassageActions
                contentType="culture_material"
                contentId={material.id}
                sectionKey="body"
                sectionLabel={t('highlights.section.body')}
                title={material.title}
                text={material.body}
                language={i18n.language !== 'kg' && material.translation?.status === 'available' ? i18n.language : 'kg'}
                simple={experience === 'child'}
              />
            </View>
          ) : (
            <Text style={styles.pending}>{t('culture.item.pendingResearch')}</Text>
          )}

          {material.body ? <ReadingActions tracker={reading} /> : null}
          <SourcesAndNotes contentType="culture_material" level={material.accuracy_level} sources={material.sources} />
          <ReportIssueLink contentType="culture_material" contentId={material.id} title={material.title} />
        </View>
      </ScrollView>
      <ReadingOverlay tracker={reading} experience={experience} />
    </View>
  );
}

const styles = StyleSheet.create({
  heroFocus: { aspectRatio: 2.4 },
  headerButtons: { flexDirection: 'row', gap: spacing.xs },
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
    gap: spacing.sm,
  },
  body: {
    ...typography.body,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  pending: {
    ...typography.body,
    color: colors.textSecondary,
  },
  field: {
    gap: spacing.xxs,
  },
  fieldLabel: {
    ...typography.overline,
    color: colors.textSecondary,
  },
  sourceLink: {
    ...typography.small,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
});
