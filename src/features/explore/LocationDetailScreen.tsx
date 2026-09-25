import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, ChevronRight, Compass, Heart, Share2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AudioGuidePlayer } from '@/components/audio/AudioGuidePlayer';
import { AddToJournalButton } from '@/components/journal/AddToJournalButton';
import { DownloadButton } from '@/components/offline/DownloadButton';
import { AnimatedPressable, FadeSlideIn, IconButton, MediaCard, MediaImage, ProgressBar, SectionHeader } from '@/components/ui';
import type { SupportedLanguage } from '@/i18n';
import { resolveByCardScale } from '@/services/ageExperience/scale';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { joinNarration } from '@/services/audioGuide/narration';
import { useShareCard } from '@/services/share/useShareCard';
import { cardRadii, colors, editorial, radii, spacing, textStyles, typography } from '@/theme';

import { DiscoveriesRow, formatVisitDate } from './components';
import { LOCATION_TONES } from './data';
import type { ExploreDiscovery, ExploreLocation } from './types';
import type { RegionState } from '@/services/explore/regionState';

const TONES = LOCATION_TONES;

const HERO_ASPECT_RATIO_BY_CARD_SCALE = { large: 1.1, medium: 1.35, compact: 1.55, dense: 1.8 };

/** A Guided Trail that really includes this destination as a step. */
export type RelatedTrail = { id: string; title: string; image: ImageSourcePropType; status?: string };

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
  /** Passport: nature destinations only; `visitedAt` is the real visit
   * timestamp (null when unknown - no date is shown then). */
  passport?: { visited: boolean; visitedAt: string | null } | null;
  relatedTrails?: RelatedTrail[];
  onPressTrail?: (trailId: string) => void;
  onPressPassport?: () => void;
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
  passport = null,
  relatedTrails = [],
  onPressTrail,
  onPressPassport,
  onPressBack,
  onPressDiscovery,
  onToggleFavorite,
  onPressRelatedQuest,
}: LocationDetailScreenProps) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { config } = useAgeExperience();
  const tone = TONES[toneIndex % TONES.length];
  const locationName = location.name[i18n.language as SupportedLanguage] ?? location.name.kg;
  const heroAspectRatio = resolveByCardScale(config.cardScale, HERO_ASPECT_RATIO_BY_CARD_SCALE);
  const isChild = config.textComplexity === 'minimal';
  const isAdult = config.characterProminence === 'subtle';
  // Child/preteen: quest front and center, close to the top. Teen/adult:
  // exploration/photography first, quest (more gamified) further down.
  const questFirst = config.characterProminence === 'primary' || config.characterProminence === 'frequent';

  const { share, shareHost } = useShareCard();
  const passportLabel = passport
    ? passport.visited
      ? passport.visitedAt
        ? t('explore.locationDetail.passportStamp', { date: formatVisitDate(passport.visitedAt) })
        : t('explore.locationDetail.passportStampNoDate')
      : t('explore.map.pinNotDiscovered')
    : '';

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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* 1. Cinematic hero - static (no parallax), title + kind on the photo. */}
        <View style={[styles.hero, { aspectRatio: heroAspectRatio }, !heroImage && { backgroundColor: tone }]}>
          {heroImage ? (
            <>
              <MediaImage source={heroImage} />
              <LinearGradient colors={[colors.scrimTop, colors.scrimClear, colors.scrimBottom]} locations={[0, 0.3, 1]} style={StyleSheet.absoluteFill} />
            </>
          ) : (
            <View style={styles.heroOrnament}>
              <OymoOrnament size={64} color="rgba(255,255,255,0.18)" strokeWidth={1.25} />
            </View>
          )}

          <View style={[styles.heroTopRow, { paddingTop: insets.top + spacing.xs }]}>
            <IconButton icon={ChevronLeft} size={40} iconSize={20} shape="roundedSquare" accessibilityLabel={t('explore.locationDetail.backLabel')} onPress={onPressBack} />
            <View style={styles.heroActions}>
              <IconButton
                icon={Heart}
                size={40}
                iconSize={19}
                shape="roundedSquare"
                accessibilityLabel={isFavorite ? t('explore.locationDetail.unfavoriteLabel') : t('explore.locationDetail.favoriteLabel')}
                onPress={onToggleFavorite}
                variant={isFavorite ? 'primary' : 'surface'}
              />
              <IconButton icon={Share2} size={40} iconSize={19} shape="roundedSquare" accessibilityLabel={t('explore.locationDetail.shareLabel')} onPress={handleShare} />
            </View>
          </View>
          <View style={styles.heroBottom}>
            <View style={styles.kindRow}>
              <OymoOrnament size={10} color={colors.accentGold} strokeWidth={1.75} />
              <Text style={styles.kind}>{t(location.kind === 'nature' ? 'explore.locationDetail.kindNature' : 'explore.locationDetail.kindRegion')}</Text>
            </View>
            <Text style={[styles.heroTitle, isAdult && styles.heroTitleEditorial]} accessibilityRole="header">
              {locationName}
            </Text>
          </View>
        </View>

        <View style={styles.body}>
          {/* 2. Short introduction (the region's real tagline). */}
          <Text style={[styles.intro, isAdult && styles.introEditorial]}>{location.tagline}</Text>

          {/* 3. The story: real sourced facts, read as paragraphs, with the
              compact audio guide right above them. Tagline and facts are
              Kyrgyz-authored (explore_regions); narration stays Kyrgyz. */}
          <FadeSlideIn style={styles.section} index={0}>
            <SectionHeader title={t('explore.locationDetail.story')} inset={0} editorialTitle={isAdult} />
            <AudioGuidePlayer
              contentKey={`region:${location.id}`}
              narration={{ lang: 'kg', text: joinNarration([location.name.kg, location.tagline, ...(isChild ? location.facts.slice(0, 2) : location.facts)]) }}
            />
            {(isChild ? location.facts.slice(0, 2) : location.facts).map((fact, index) => (
              <View key={index} style={styles.factRow}>
                <View style={styles.factMark}>
                  <OymoOrnament size={8} color={colors.accentGoldPressed} strokeWidth={2} />
                </View>
                <Text style={[styles.factText, isChild && styles.factTextChild]}>{fact}</Text>
              </View>
            ))}
          </FadeSlideIn>

          {questFirst ? questCard : null}

          <View style={styles.discoveriesSection}>
            {discoveries.length > 0 ? (
              <DiscoveriesRow
                discoveries={discoveries}
                discoveredIds={discoveredIds}
                onPressDiscovery={(discovery) => onPressDiscovery?.(discovery.id)}
                title={t('explore.locationDetail.discoveriesTitle')}
              />
            ) : (
              <View style={[styles.section, styles.padded]}>
                <SectionHeader title={t('explore.locationDetail.discoveriesTitle')} size="sm" inset={0} />
                <Text style={styles.emptyText}>{t('explore.locationDetail.noDiscoveries')}</Text>
              </View>
            )}
          </View>

          {/* 4. Passport status (nature only) + this place's real discovery
              progress - a quiet status card, not a banner. */}
          <View style={styles.statusCard}>
            {passport ? (
              <AnimatedPressable
                style={styles.statusRow}
                onPress={onPressPassport}
                disabled={!onPressPassport}
                press="soft"
                accessibilityRole="button"
                accessibilityLabel={`${t('explore.locationDetail.passportLink')}. ${passportLabel}`}
              >
                <View style={[styles.stamp, passport.visited ? styles.stampOn : styles.stampOff]}>
                  <OymoOrnament size={14} color={passport.visited ? colors.textPrimary : colors.accentBrown} strokeWidth={1.75} />
                </View>
                <Text style={styles.statusText} numberOfLines={2}>
                  {passportLabel}
                </Text>
                {onPressPassport ? <ChevronRight size={16} color={colors.textMuted} strokeWidth={2.25} /> : null}
              </AnimatedPressable>
            ) : null}
            <View style={styles.progressBlock}>
              <View style={styles.progressLabelRow}>
                <Text style={styles.progressLabel}>{t('explore.locationDetail.progressLabel', { percent: location.discoveredPercent })}</Text>
                <Text style={styles.stateLabel}>{t(`explore.locationDetail.state.${state}`)}</Text>
              </View>
              <ProgressBar progress={location.discoveredPercent / 100} height={5} trackColor={colors.surfaceMuted} />
            </View>
          </View>

          {/* 5. Trail connection - only trails that really include this place. */}
          {relatedTrails.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader title={t('explore.locationDetail.trailsTitle')} size="sm" inset={0} />
              {relatedTrails.map((trail) => (
                <MediaCard
                  key={trail.id}
                  variant="landscape"
                  aspectRatio={2.4}
                  source={trail.image}
                  title={trail.title}
                  titleLines={1}
                  subtitle={trail.status}
                  chevron
                  onPress={() => onPressTrail?.(trail.id)}
                  accessibilityLabel={`${trail.title}${trail.status ? `. ${trail.status}` : ''}`}
                />
              ))}
            </View>
          ) : null}

          {/* 6. Journal + offline - secondary, side by side. */}
          {location.kind === 'nature' ? (
            <View style={styles.secondaryActions}>
              <AddToJournalButton type="nature_site" id={location.id} title={locationName} />
              <DownloadButton kind="nature" contentId={location.id} title={locationName} />
            </View>
          ) : null}

          {!questFirst ? questCard : null}
        </View>
      </ScrollView>
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
    borderBottomLeftRadius: cardRadii.hero,
    borderBottomRightRadius: cardRadii.hero,
    overflow: 'hidden',
    backgroundColor: colors.surfaceFeature,
  },
  kindRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  kind: {
    ...textStyles.overline,
    color: colors.accentGold,
  },
  heroTitleEditorial: {
    ...editorial(textStyles.display),
  },
  intro: {
    ...textStyles.body,
    fontSize: 17,
    lineHeight: 25,
    color: colors.textPrimary,
  },
  introEditorial: {
    fontStyle: 'italic',
  },
  padded: {
    paddingHorizontal: spacing.md,
  },
  factMark: {
    width: 16,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  factTextChild: {
    fontSize: 17,
    lineHeight: 25,
  },
  statusCard: {
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: cardRadii.media,
    backgroundColor: colors.surfaceElevated,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
  },
  stamp: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  stampOn: {
    backgroundColor: colors.accentGold,
    borderColor: colors.accentGoldPressed,
  },
  stampOff: {
    borderStyle: 'dashed',
    borderColor: colors.accentBrown,
  },
  statusText: {
    ...textStyles.bodyMedium,
    color: colors.textPrimary,
    flex: 1,
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
    ...textStyles.display,
    color: colors.textOnDark,
  },
  secondaryActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  body: {
    padding: spacing.md,
    paddingTop: spacing.lg,
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
    ...textStyles.caption,
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
  factText: {
    ...textStyles.body,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textPrimary,
    flex: 1,
  },
  questCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceWarm,
    borderRadius: cardRadii.media,
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
