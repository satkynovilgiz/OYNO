import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Compass, Heart, Share2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AudioGuidePlayer } from '@/components/audio/AudioGuidePlayer';
import { DownloadButton } from '@/components/offline/DownloadButton';
import { AnimatedPressable, FadeSlideIn, IconButton, ProgressBar } from '@/components/ui';
import type { SupportedLanguage } from '@/i18n';
import { resolveByCardScale } from '@/services/ageExperience/scale';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { joinNarration } from '@/services/audioGuide/narration';
import { useHeroParallax } from '@/services/motion/useHeroParallax';
import { useShareCard } from '@/services/share/useShareCard';
import { colors, radii, spacing, typography } from '@/theme';

import { DiscoveriesRow } from './components';
import { LOCATION_TONES } from './data';
import type { ExploreDiscovery, ExploreLocation } from './types';
import type { RegionState } from '@/services/explore/regionState';

const TONES = LOCATION_TONES;

const HERO_ASPECT_RATIO_BY_CARD_SCALE = { large: 1.1, medium: 1.35, compact: 1.55, dense: 1.8 };

export type RelatedQuest = {
  title: string;
  ctaLabel: string;
} | null;

type LocationDetailScreenProps = {
  location: ExploreLocation;
  toneIndex: number;
  state: RegionState;
  /** A real photo from one of this region's own discoveries, when
   * bundled art exists for it - never a generic/unrelated stand-in (spec
   * "Do not fabricate missing information"). Null falls back to an
   * editorial color+ornament treatment instead of pretending to be a
   * photo of this specific place. */
  heroImage: ImageSourcePropType | null;
  discoveries: ExploreDiscovery[];
  discoveredIds: string[];
  isFavorite: boolean;
  /** Only set when a step of the player's *active* quest genuinely
   * targets this location or one of its discoveries - real quest state,
   * never shown speculatively. */
  relatedQuest: RelatedQuest;
  onPressBack?: () => void;
  onPressDiscovery?: (discoveryId: string) => void;
  onToggleFavorite?: () => void;
  onPressRelatedQuest?: () => void;
};

/**
 * One shared "enter this place" destination page (spec "Create/rework the
 * shared Destination Detail experience... Keep one shared screen") -
 * cinematic photo hero when real art exists for this region (reused from
 * one of its own discoveries, never fabricated), a calmer editorial color
 * treatment when it doesn't, real sourced facts presented without a wall
 * of bordered boxes, the existing discoveries row untouched, and an
 * honest "part of your quest" prompt only when quest state actually says
 * so. Adapts density/framing by AgeExperience, never the underlying data.
 */
export function LocationDetailScreen({
  location,
  toneIndex,
  state,
  heroImage,
  discoveries,
  discoveredIds,
  isFavorite,
  relatedQuest,
  onPressBack,
  onPressDiscovery,
  onToggleFavorite,
  onPressRelatedQuest,
}: LocationDetailScreenProps) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { config } = useAgeExperience();
  const { scrollHandler, heroStyle } = useHeroParallax();
  const tone = TONES[toneIndex % TONES.length];
  const locationName = location.name[i18n.language as SupportedLanguage] ?? location.name.kg;
  const heroAspectRatio = resolveByCardScale(config.cardScale, HERO_ASPECT_RATIO_BY_CARD_SCALE);
  const isChild = config.textComplexity === 'minimal';
  const isAdult = config.characterProminence === 'subtle';
  // Child/preteen: quest front and center, close to the top. Teen/adult:
  // exploration/photography first, quest (more gamified) further down.
  const questFirst = config.characterProminence === 'primary' || config.characterProminence === 'frequent';

  const { share, shareHost } = useShareCard();

  // Share card = this destination's own hero art (or its tone), its name
  // and a "Place" label; plain text on builds/platforms without image
  // sharing (see useShareCard).
  function handleShare() {
    void share(
      { title: locationName, label: t('saved.contentTypes.region'), imageSource: heroImage, fallbackTone: tone },
      t('explore.locationDetail.shareMessage', { name: locationName }),
    );
  }

  const questCard = relatedQuest ? (
    <FadeSlideIn style={styles.section} index={0}>
      <AnimatedPressable
        style={styles.questCard}
        onPress={onPressRelatedQuest}
        hoverEffect
        haptic="light"
        accessibilityRole="button"
        accessibilityLabel={relatedQuest.title}
      >
        <View style={styles.questIcon}>
          <Compass size={20} color={colors.textOnPrimary} strokeWidth={2} />
        </View>
        <View style={styles.questBody}>
          <Text style={styles.questLabel}>{t('explore.locationDetail.questLabel')}</Text>
          <Text style={styles.questTitle} numberOfLines={1}>
            {relatedQuest.title}
          </Text>
        </View>
        <Text style={styles.questCta}>{relatedQuest.ctaLabel}</Text>
      </AnimatedPressable>
    </FadeSlideIn>
  ) : null;

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        <View style={[styles.hero, { aspectRatio: heroAspectRatio }, !heroImage && { backgroundColor: tone }]}>
          {heroImage ? (
            <>
              <Animated.Image source={heroImage} style={[styles.heroImage, heroStyle]} resizeMode="cover" />
              <LinearGradient
                colors={['rgba(19,32,24,0.1)', 'rgba(19,32,24,0.88)']}
                locations={[0.35, 1]}
                style={StyleSheet.absoluteFill}
              />
            </>
          ) : (
            <View style={styles.heroOrnament}>
              <OymoOrnament size={64} color="rgba(255,255,255,0.18)" strokeWidth={1.25} />
            </View>
          )}

          <View style={[styles.heroTopRow, { paddingTop: insets.top + spacing.sm }]}>
            <IconButton
              icon={ChevronLeft}
              shape="roundedSquare"
              accessibilityLabel={t('explore.locationDetail.backLabel')}
              onPress={onPressBack}
              variant="surface"
            />
            <View style={styles.heroActions}>
              <IconButton
                icon={Heart}
                shape="roundedSquare"
                accessibilityLabel={
                  isFavorite ? t('explore.locationDetail.unfavoriteLabel') : t('explore.locationDetail.favoriteLabel')
                }
                onPress={onToggleFavorite}
                variant={isFavorite ? 'primary' : 'surface'}
              />
              <IconButton
                icon={Share2}
                shape="roundedSquare"
                accessibilityLabel={t('explore.locationDetail.shareLabel')}
                onPress={handleShare}
                variant="surface"
              />
            </View>
          </View>
          <View style={styles.heroBottom}>
            <Text style={styles.heroTitle}>{locationName}</Text>
            <Text style={styles.heroSubtitle}>{location.tagline}</Text>
          </View>
        </View>

        <View style={styles.body}>
          {/* Tagline and facts are Kyrgyz-authored (explore_regions); the
              name is read in its Kyrgyz form to match. Only facts this
              screen actually shows are read. */}
          <AudioGuidePlayer
            contentKey={`region:${location.id}`}
            narration={{ lang: 'kg', text: joinNarration([location.name.kg, location.tagline, ...(isChild ? location.facts.slice(0, 2) : location.facts)]) }}
          />

          {location.kind === 'nature' ? <DownloadButton kind="nature" contentId={location.id} title={locationName} /> : null}

          {questFirst ? questCard : null}

          <FadeSlideIn style={styles.progressBlock} index={1}>
            <View style={styles.progressLabelRow}>
              <Text style={styles.progressLabel}>
                {t('explore.locationDetail.progressLabel', { percent: location.discoveredPercent })}
              </Text>
              <Text style={styles.stateLabel}>{t(`explore.locationDetail.state.${state}`)}</Text>
            </View>
            <ProgressBar progress={location.discoveredPercent / 100} height={8} />
          </FadeSlideIn>

          <View style={styles.discoveriesSection}>
            {discoveries.length > 0 ? (
              <DiscoveriesRow
                discoveries={discoveries}
                discoveredIds={discoveredIds}
                onPressDiscovery={(discovery) => onPressDiscovery?.(discovery.id)}
                title={t('explore.locationDetail.discoveriesTitle')}
              />
            ) : (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('explore.locationDetail.discoveriesTitle')}</Text>
                <Text style={styles.emptyText}>{t('explore.locationDetail.noDiscoveries')}</Text>
              </View>
            )}
          </View>

          <FadeSlideIn style={styles.section} index={2}>
            <Text style={styles.sectionTitle}>{t('explore.locationDetail.factsTitle')}</Text>
            {(isChild ? location.facts.slice(0, 2) : location.facts).map((fact, index) => (
              <View key={index} style={styles.factRow}>
                <Text style={styles.factNumber}>{index + 1}</Text>
                <Text style={[styles.factText, isAdult && styles.factTextDense]}>{fact}</Text>
              </View>
            ))}
          </FadeSlideIn>

          {!questFirst ? questCard : null}
        </View>
      </Animated.ScrollView>
      {shareHost}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  hero: {
    width: '100%',
    justifyContent: 'space-between',
    borderBottomLeftRadius: radii.xxl,
    borderBottomRightRadius: radii.xxl,
    overflow: 'hidden',
  },
  heroImage: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  heroOrnament: {
    ...StyleSheet.absoluteFill,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    padding: spacing.lg,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  heroActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  heroBottom: {
    padding: spacing.md,
    gap: spacing.xxs,
  },
  heroTitle: {
    ...typography.display,
    color: colors.textOnDark,
  },
  heroSubtitle: {
    ...typography.body,
    color: colors.textOnDark,
    opacity: 0.9,
  },
  body: {
    padding: spacing.md,
    gap: spacing.xl,
  },
  progressBlock: {
    gap: spacing.xxs,
  },
  progressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  stateLabel: {
    ...typography.small,
    color: colors.primary,
    fontWeight: '700',
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  discoveriesSection: {
    marginHorizontal: -spacing.md,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  factRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  factNumber: {
    ...typography.overline,
    color: colors.accentGold,
    width: 20,
  },
  factText: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
    lineHeight: 21,
  },
  factTextDense: {
    ...typography.caption,
    lineHeight: 19,
  },
  questCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceWarm,
    borderRadius: radii.xl,
    padding: spacing.sm,
  },
  questIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  questBody: {
    flex: 1,
    gap: 1,
  },
  questLabel: {
    ...typography.overline,
    color: colors.textSecondary,
  },
  questTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  questCta: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primary,
  },
});
