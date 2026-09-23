import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowRight, Check, ChevronLeft, ChevronRight, Clock, TriangleAlert } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, type ImageSourcePropType, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AudioGuidePlayer } from '@/components/audio/AudioGuidePlayer';
import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable, EmptyState, FadeSlideIn, IconButton, Skeleton } from '@/components/ui';
import { interactiveExperienceForCategory, routeForInteractiveExperience } from '@/features/culture/interactiveExperiences';
import { mockGamesList } from '@/features/games/mockData';
import { gameTitleKey } from '@/features/games/types';
import type { SupportedLanguage } from '@/i18n';
import type { AgeExperience } from '@/services/ageExperience/types';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { useTrackScreenView } from '@/services/analytics/useTrackScreenView';
import { joinNarration, type Narration } from '@/services/audioGuide/narration';
import { buildImageChallenge } from '@/services/daily/dailyDiscovery';
import { useShareCard } from '@/services/share/useShareCard';
import { useDailyDiscoveryStore } from '@/store/useDailyDiscoveryStore';
import { useProgressStore } from '@/store/useProgressStore';
import { colors, fontFamily, radii, spacing, typography } from '@/theme';

import { DailyImageChallenge } from './components/DailyImageChallenge';
import { dailyHasChallenge } from './dailyContent';
import { formatDayLabel } from './formatDayLabel';
import { dailyImageOf, useTodayDiscovery, type TodayDiscovery } from './useTodayDiscovery';

/** Culture items that have their own playable game - the same pairings the
 * "Horse Culture" collection already makes (collectionsData.ts). */
const RELATED_GAME_BY_ITEM: Record<string, string> = {
  'horse-kok-boru': 'kok-boru',
  'horse-kyz-kuumai': 'kyz-kuumay',
};

/** How far the reading sheet tucks up over the bottom of the hero photo. */
const SHEET_OVERLAP = 28;

function useHeroHeight(): number {
  const { height } = useWindowDimensions();
  // Artwork-first: the photo owns most of the first viewport on every
  // phone size, without pushing the title below the fold on short screens.
  return Math.round(Math.min(Math.max(height * 0.6, 380), 580));
}

type DailyDiscoveryScreenProps = {
  onPressBack: () => void;
};

/**
 * "Daily OYNO" - one focused, 1-3 minute look at a single real culture
 * item, presented as a small daily story: a full-bleed photo hero, the
 * item's own text on a cream reading sheet, an optional picture challenge,
 * then one clear completion step and a real next place to go. The text is
 * the item's own stored fields (see dailyContent.ts), the challenge is
 * built from real bundled photos, and completion feeds the EXISTING
 * progress path (`discoverCulture` - the same action Culture's
 * today-discovery card uses) instead of a new reward/streak system.
 */
export function DailyDiscoveryScreen({ onPressBack }: DailyDiscoveryScreenProps) {
  useTrackScreenView('daily_discovery');
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { isLoading, discovery } = useTodayDiscovery();

  if (isLoading) return <DailyLoadingState onPressBack={onPressBack} />;

  if (!discovery) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <EmptyState
          icon={TriangleAlert}
          title={t('daily.unavailableTitle')}
          description={t('daily.unavailableDescription')}
          actionLabel={t('common.back')}
          onPressAction={onPressBack}
        />
      </View>
    );
  }

  return <DailyDiscoveryContent key={discovery.dateKey} discovery={discovery} onPressBack={onPressBack} />;
}

/** Same hero height and reading-sheet geometry as the real screen, so
 * nothing jumps when today's item arrives - no spinner, no fake delay. */
function DailyLoadingState({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const heroHeight = useHeroHeight();

  return (
    <View style={styles.root}>
      <Skeleton height={heroHeight} borderRadius={0} />
      <View style={[styles.backButton, { top: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" variant="surface" accessibilityLabel={t('common.back')} onPress={onPressBack} />
      </View>
      <View style={[styles.sheet, styles.loadingSheet]}>
        <Skeleton width="45%" height={12} />
        <Skeleton height={16} />
        <Skeleton height={16} />
        <Skeleton width="80%" height={16} />
        <Skeleton height={54} borderRadius={radii.pill} style={styles.loadingCta} />
      </View>
    </View>
  );
}

function DailyDiscoveryContent({ discovery, onPressBack }: { discovery: TodayDiscovery; onPressBack: () => void }) {
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const insets = useSafeAreaInsets();
  const heroHeight = useHeroHeight();
  const { experience } = useAgeExperience();
  const scrollRef = useRef<ScrollView>(null);
  const { item } = discovery;

  const hasChallenge = dailyHasChallenge(experience) && !discovery.isCompleted;
  const [challenge] = useState(() => buildImageChallenge(item, discovery.pool, discovery.dateKey, dailyImageOf));
  // A challenge with fewer than 2 photos isn't a choice - skip it rather
  // than show a one-option "quiz".
  const challengeUsable = hasChallenge && challenge.length >= 2;
  const [solved, setSolved] = useState(false);
  const [completing, setCompleting] = useState(false);

  const canComplete = !challengeUsable || solved;
  const isAdult = experience === 'adult';
  const isYoung = experience === 'child' || experience === 'preteen';

  async function handleComplete() {
    if (!canComplete || completing) return;
    setCompleting(true);
    await useDailyDiscoveryStore.getState().complete(discovery.dateKey, item.id);
    // Existing progress, not a new system: counts as a culture discovery
    // (and as today's activity for the existing streak), and reports the
    // same OPEN_CULTURE_ITEM quest event opening this item normally does.
    // Both are no-ops for guests, matching the rest of the app.
    void useProgressStore.getState().discoverCulture();
    void useProgressStore.getState().advanceQuestStep('OPEN_CULTURE_ITEM', item.id);
    setCompleting(false);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
  }

  const [leadBlock, ...moreBlocks] = discovery.textBlocks;
  // Narrate the title + the story blocks shown below, only when they're all
  // in one language (a Kyrgyz field never gets read with a ru/en voice).
  const blockLangs = new Set(discovery.textBlocks.map((block) => block.lang));
  const narration: Narration | null =
    blockLangs.size === 1 ? { lang: discovery.textBlocks[0].lang, text: joinNarration([item.title, ...discovery.textBlocks.map((block) => block.text)]) } : null;
  const dayLabel = formatDayLabel(discovery.dateKey, language);

  return (
    <View style={styles.root}>
      <ScrollView ref={scrollRef} contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { height: heroHeight }]}>
          <Image source={discovery.imageSource} style={styles.heroImage} resizeMode="cover" />
          <LinearGradient colors={['rgba(19,32,24,0.45)', 'rgba(19,32,24,0)']} locations={[0, 1]} style={styles.heroTopScrim} />
          <LinearGradient
            colors={['rgba(19,32,24,0)', 'rgba(19,32,24,0.55)', 'rgba(19,32,24,0.94)']}
            locations={[0, 0.45, 1]}
            style={styles.heroBottomScrim}
          />

          <View style={[styles.heroText, { paddingBottom: SHEET_OVERLAP + spacing.md }]}>
            <View style={styles.eyebrowRow}>
              <OymoOrnament size={11} color={colors.accentGold} strokeWidth={1.75} />
              <Text style={styles.heroEyebrow} numberOfLines={1}>
                {t('daily.overline')} · {dayLabel}
              </Text>
            </View>
            <Text style={[styles.heroTitle, isAdult && styles.heroTitleEditorial]} numberOfLines={3}>
              {item.title}
            </Text>
            <View style={styles.heroMetaRow}>
              <View style={styles.heroChip}>
                <Clock size={12} color={colors.textOnDark} strokeWidth={2.25} />
                <Text style={styles.heroChipText}>{t('daily.minutes', { count: discovery.minutes })}</Text>
              </View>
              {discovery.categoryTitle ? (
                <View style={styles.heroChip}>
                  <Text style={styles.heroChipText}>{discovery.categoryTitle}</Text>
                </View>
              ) : null}
              {item.accuracy_level === 'partially_verified' ? (
                <View style={[styles.heroChip, styles.heroChipQuiet]}>
                  <Text style={[styles.heroChipText, styles.heroChipTextQuiet]}>{t('culture.item.accuracy.partially_verified')}</Text>
                </View>
              ) : null}
              {discovery.isCompleted ? (
                <View style={[styles.heroChip, styles.heroChipDone]}>
                  <Check size={12} color={colors.textPrimary} strokeWidth={3} />
                  <Text style={[styles.heroChipText, styles.heroChipTextDone]}>{t('daily.entry.done')}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <View style={[styles.backButton, { top: insets.top + spacing.sm }]}>
          <IconButton icon={ChevronLeft} shape="roundedSquare" variant="surface" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        </View>

        <View style={styles.sheet}>
          {/* "Listen · 2 min" - shown only when audio genuinely works here. */}
          <AudioGuidePlayer contentKey={`culture_item:${item.id}`} narration={narration} hideWhenUnavailable />

          {leadBlock ? (
            <FadeSlideIn>
              {leadBlock.labelKey ? <Text style={styles.blockLabel}>{t(leadBlock.labelKey)}</Text> : null}
              <Text style={[styles.lead, isAdult && styles.leadEditorial, isYoung && styles.leadYoung]}>{leadBlock.text}</Text>
            </FadeSlideIn>
          ) : null}

          {moreBlocks.map((block, index) => (
            <FadeSlideIn key={`${block.labelKey ?? 'block'}-${index}`} index={index + 1} style={styles.block}>
              <OrnamentDivider />
              {block.labelKey ? <Text style={styles.blockLabel}>{t(block.labelKey)}</Text> : null}
              <Text style={[styles.body, isAdult && styles.bodyEditorial]}>{block.text}</Text>
            </FadeSlideIn>
          ))}

          {challengeUsable ? (
            <View style={styles.block}>
              <OrnamentDivider />
              <DailyImageChallenge
                title={item.title}
                options={challenge}
                imageOf={dailyImageOf}
                layout={isYoung ? 'stack' : 'row'}
                onSolved={() => setSolved(true)}
              />
            </View>
          ) : null}

          {discovery.isCompleted ? (
            <FadeSlideIn style={styles.block}>
              <DailyCompletedState discovery={discovery} experience={experience} />
            </FadeSlideIn>
          ) : (
            <View style={styles.ctaBlock}>
              <PrimaryAction
                label={t('daily.complete')}
                onPress={handleComplete}
                disabled={!canComplete || completing}
                size={isYoung ? 'large' : 'regular'}
                icon="check"
              />
              {!canComplete ? <Text style={styles.ctaHint}>{t('daily.completeHint')}</Text> : null}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * The finished state - never a dead end. A gold "stamp" of today's photo
 * (the same visual language as the Journey passport), the tomorrow note
 * with no countdown, the real progress this added (days collected on this
 * device, linked to My Journey), and ONE primary next step chosen from real
 * routes only: the item's interactive experience, else its game, else the
 * full culture entry.
 */
function DailyCompletedState({ discovery, experience }: { discovery: TodayDiscovery; experience: AgeExperience }) {
  const { t } = useTranslation();
  const completedDays = useDailyDiscoveryStore((state) => Object.keys(state.completions).length);
  const { item } = discovery;
  const isAdult = experience === 'adult';

  const experienceRef = interactiveExperienceForCategory(item.category_id);
  const experienceRoute = experienceRef ? routeForInteractiveExperience(experienceRef.id) : null;
  const relatedGame = mockGamesList.find((game) => game.id === RELATED_GAME_BY_ITEM[item.id] && game.route);
  const itemRoute = `/culture/item/${item.id}`;
  const { share, shareHost } = useShareCard();

  const primary =
    experienceRef && experienceRoute
      ? { label: `${t('daily.done.tryIt')}: ${t(experienceRef.titleKey)}`, route: experienceRoute }
      : relatedGame?.route
        ? { label: `${t('daily.done.play')}: ${t(gameTitleKey(relatedGame.id))}`, route: relatedGame.route }
        : { label: t('daily.done.readMore'), route: itemRoute };

  return (
    <View style={styles.done}>
      <OrnamentDivider />

      <View style={styles.doneHeader}>
        <DoneStamp imageSource={discovery.imageSource} />
        <View style={styles.doneHeaderText}>
          <Text style={styles.doneEyebrow}>{t('daily.done.eyebrow')}</Text>
          <Text style={[styles.doneTitle, isAdult && styles.doneTitleEditorial]}>{t('daily.done.title')}</Text>
          <Text style={styles.doneTomorrow}>{t('daily.done.tomorrow')}</Text>
        </View>
      </View>

      {completedDays > 0 ? (
        <AnimatedPressable
          style={styles.impactRow}
          onPress={() => router.push('/journey' as never)}
          hoverEffect
          accessibilityRole="button"
          accessibilityLabel={t('daily.done.impact', { count: completedDays })}
        >
          <OymoOrnament size={12} color={colors.accentGoldPressed} strokeWidth={1.75} />
          <Text style={styles.impactText}>{t('daily.done.impact', { count: completedDays })}</Text>
          <ChevronRight size={16} color={colors.textSecondary} strokeWidth={2.25} />
        </AnimatedPressable>
      ) : null}

      <PrimaryAction label={primary.label} onPress={() => router.push(primary.route as never)} size={experience === 'child' || experience === 'preteen' ? 'large' : 'regular'} icon="arrow" />

      <View style={styles.secondaryRow}>
        {primary.route !== itemRoute ? <SecondaryLink label={t('daily.done.readMore')} onPress={() => router.push(itemRoute as never)} /> : null}
        <SecondaryLink
          label={t('share.action')}
          onPress={() =>
            void share(
              { title: item.title, label: t('daily.overline'), imageSource: discovery.imageSource, completedLabel: t('daily.entry.done') },
              t('share.message', { title: item.title }),
            )
          }
        />
        <SecondaryLink label={t('daily.done.home')} onPress={() => router.replace('/home')} />
      </View>
      {shareHost}
    </View>
  );
}

function DoneStamp({ imageSource }: { imageSource: ImageSourcePropType }) {
  return (
    <View style={styles.stampOuter}>
      <View style={styles.stampInner}>
        <Image source={imageSource} style={styles.stampImage} resizeMode="cover" />
      </View>
      <View style={styles.stampCheck}>
        <Check size={13} color={colors.textPrimary} strokeWidth={3} />
      </View>
    </View>
  );
}

function PrimaryAction({
  label,
  onPress,
  disabled = false,
  size,
  icon,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  size: 'large' | 'regular';
  icon: 'check' | 'arrow';
}) {
  const Icon = icon === 'check' ? Check : ArrowRight;
  return (
    <AnimatedPressable
      style={[styles.primary, size === 'large' && styles.primaryLarge, disabled && styles.primaryDisabled]}
      onPress={onPress}
      disabled={disabled}
      pressScale={0.98}
      haptic={disabled ? false : 'light'}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
    >
      <Text style={[styles.primaryLabel, size === 'large' && styles.primaryLabelLarge]} numberOfLines={2}>
        {label}
      </Text>
      <Icon size={size === 'large' ? 20 : 18} color={colors.accentGold} strokeWidth={2.5} />
    </AnimatedPressable>
  );
}

function SecondaryLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <AnimatedPressable style={styles.secondaryLink} onPress={onPress} hoverEffect accessibilityRole="button" accessibilityLabel={label}>
      <Text style={styles.secondaryLinkText}>{label}</Text>
    </AnimatedPressable>
  );
}

function OrnamentDivider() {
  return (
    <View style={styles.divider} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.dividerLine} />
      <OymoOrnament size={10} color={colors.accentGoldPressed} strokeWidth={1.5} />
      <View style={styles.dividerLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  hero: {
    width: '100%',
    backgroundColor: colors.surfaceFeature,
  },
  heroImage: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  heroTopScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  heroBottomScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '62%',
  },
  heroText: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  heroEyebrow: {
    ...typography.overline,
    color: colors.accentGold,
    flexShrink: 1,
  },
  heroTitle: {
    ...typography.display,
    fontSize: 32,
    lineHeight: 38,
    color: colors.textOnDark,
  },
  heroTitleEditorial: {
    fontFamily: fontFamily.wordmark,
    fontSize: 34,
    lineHeight: 40,
  },
  heroMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xxs,
  },
  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  heroChipQuiet: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  heroChipDone: {
    backgroundColor: colors.accentGold,
  },
  heroChipText: {
    ...typography.small,
    color: colors.textOnDark,
  },
  heroChipTextQuiet: {
    color: 'rgba(255,255,255,0.8)',
  },
  heroChipTextDone: {
    color: colors.textPrimary,
  },
  backButton: {
    position: 'absolute',
    left: spacing.md,
  },
  // The cream reading sheet tucks up over the photo's bottom edge - one
  // continuous surface for the story, not a stack of boxed cards.
  sheet: {
    marginTop: -SHEET_OVERLAP,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  loadingSheet: {
    gap: spacing.sm,
  },
  loadingCta: {
    marginTop: spacing.lg,
  },
  block: {
    gap: spacing.sm,
  },
  blockLabel: {
    ...typography.overline,
    color: colors.accentTerracotta,
    marginBottom: spacing.xxs,
  },
  lead: {
    ...typography.body,
    fontSize: 17,
    lineHeight: 27,
    color: colors.textPrimary,
  },
  leadYoung: {
    fontSize: 18,
    lineHeight: 28,
  },
  leadEditorial: {
    fontFamily: fontFamily.wordmark,
    fontSize: 18,
    lineHeight: 29,
  },
  body: {
    ...typography.body,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  bodyEditorial: {
    fontFamily: fontFamily.wordmark,
    fontSize: 16,
    lineHeight: 26,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  ctaBlock: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  ctaHint: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 54,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  primaryLarge: {
    minHeight: 62,
  },
  primaryDisabled: {
    backgroundColor: colors.primaryMuted,
    opacity: 0.55,
  },
  primaryLabel: {
    ...typography.bodyBold,
    color: colors.textOnPrimary,
    textAlign: 'center',
    flexShrink: 1,
  },
  primaryLabelLarge: {
    fontSize: 17,
  },
  done: {
    gap: spacing.md,
  },
  doneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  doneHeaderText: {
    flex: 1,
    gap: 2,
  },
  doneEyebrow: {
    ...typography.overline,
    color: colors.accentTerracotta,
  },
  doneTitle: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  doneTitleEditorial: {
    fontFamily: fontFamily.wordmark,
  },
  doneTomorrow: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  stampOuter: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2,
    borderColor: colors.accentGold,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-5deg' }],
  },
  stampInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.accentGoldPressed,
  },
  stampImage: {
    width: '100%',
    height: '100%',
  },
  stampCheck: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.accentGold,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  impactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceWarm,
  },
  impactText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '700',
    flex: 1,
  },
  secondaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: spacing.lg,
  },
  secondaryLink: {
    paddingVertical: spacing.xs,
  },
  secondaryLinkText: {
    ...typography.bodyBold,
    color: colors.primary,
  },
});
