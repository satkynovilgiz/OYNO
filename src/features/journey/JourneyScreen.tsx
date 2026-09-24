import { router } from 'expo-router';
import { ArrowRight, ChevronLeft, Compass, Gamepad2, Medal, Sparkles, type LucideIcon } from 'lucide-react-native';
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AgeExperienceTransition, AnimatedPressable, FadeSlideIn, HeroEntrance, IconButton, ProgressBar } from '@/components/ui';
import { formatDayLabel } from '@/features/daily/formatDayLabel';
import { useTodayDiscovery } from '@/features/daily/useTodayDiscovery';
import { cultureItemImages } from '@/features/culture/data';
import { computeCollectionProgress } from '@/features/collections/collectionProgress';
import { collections } from '@/features/collections/collectionsData';
import { useCollectionSignals } from '@/features/collections/useCollectionProgress';
import { discoveryImages, natureSiteImages } from '@/features/explore/data';
import { computeTrailProgress } from '@/features/trails/trailProgress';
import { trails } from '@/features/trails/trailsData';
import { useTrailSignals } from '@/features/trails/useTrailSignals';
import { mockGamesList } from '@/features/games/mockData';
import { profileAchievements } from '@/features/profile/data';
import type { SupportedLanguage } from '@/i18n';
import { resolveByCardScale } from '@/services/ageExperience/scale';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { useTrackScreenView } from '@/services/analytics/useTrackScreenView';
import { useAllCultureItems } from '@/services/content/cultureItemsService';
import { useDiscoveries } from '@/services/content/discoveriesService';
import { useExploreRegions } from '@/services/content/exploreService';
import { xpProgress } from '@/services/progress/levelConfig';
import { useAuthStore } from '@/store/useAuthStore';
import { useDailyDiscoveryStore } from '@/store/useDailyDiscoveryStore';
import { useProgressStore } from '@/store/useProgressStore';
import { colors, fontFamily, radii, spacing, typography } from '@/theme';
import journeyBackdrop from '@assets/img/OYNO_design/explore/quest_boru_shyrdak.png';

import { CollectionsJourneySection } from './components/CollectionsJourneySection';
import { JournalJourneySection } from './components/JournalJourneySection';
import { LearningJourneySection } from './components/LearningJourneySection';
import { TrailsJourneySection } from './components/TrailsJourneySection';
import { JourneyStamp } from './components/JourneyStamp';
import { PassportSection } from './components/PassportSection';
import {
  buildJourneySummary,
  getJourneySectionOrder,
  pickNextDiscovery,
  type JourneySectionId,
  type JourneyStamp as JourneyStampData,
  type NextDiscovery,
} from './journeyData';
import { buildPassport } from './passport';

const CHAPTER_NUMERALS = ['I', 'II', 'III', 'IV'];

const STAMP_SIZE_BY_CARD_SCALE = { large: 88, medium: 76, compact: 68, dense: 64 };

type JourneyScreenProps = {
  onPressBack: () => void;
};

function go(route: string | null) {
  if (route) router.push(route as never);
}

/**
 * "My OYNO Journey" (spec "cultural passport + adventure journal... NOT a
 * banking/fitness dashboard"). A deep-green passport cover with the real
 * stamp total, then one "page" per kind of journey - discovered, explored,
 * played, achievements - each filled with stamps built from the progress
 * the app already records (see journeyData.ts). Unearned slots stay on
 * the page as faded, tappable outlines, so a brand-new user sees an
 * honest empty passport that also shows where to go, never fake numbers.
 */
export function JourneyScreen({ onPressBack }: JourneyScreenProps) {
  useTrackScreenView('journey');
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const insets = useSafeAreaInsets();
  const { experience, config } = useAgeExperience();
  const stampSize = resolveByCardScale(config.cardScale, STAMP_SIZE_BY_CARD_SCALE);
  const isChild = experience === 'child';
  const isAdult = experience === 'adult';
  const showProgressBars = experience === 'teen' || experience === 'preteen';

  const progress = useProgressStore();
  const user = useAuthStore((state) => state.user);
  const isSignedIn = useAuthStore((state) => state.status === 'authenticated');
  const dailyCompletions = useDailyDiscoveryStore((state) => state.completions);
  const { data: regions } = useExploreRegions();
  const { data: discoveries } = useDiscoveries();
  const { data: cultureItems } = useAllCultureItems();
  const { discovery: today } = useTodayDiscovery();
  const collectionSignals = useCollectionSignals();
  const trailSignals = useTrailSignals();

  const summary = useMemo(
    () =>
      buildJourneySummary(
        progress,
        {
          games: mockGamesList,
          regions: regions ?? [],
          discoveries: discoveries ?? [],
          discoveryImages,
          achievements: profileAchievements,
          cultureItems: cultureItems ?? [],
          cultureItemImage: (id) => cultureItemImages[id]?.[0],
          dailyCompletions,
        },
        t,
        language,
        (played, won) => t('journey.played.detail', { played, won }),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [progress, regions, discoveries, cultureItems, dailyCompletions, language],
  );

  const todayStamp: JourneyStampData | null = today
    ? { id: today.item.id, title: today.item.title, imageSource: today.imageSource, earned: today.isCompleted, detail: null, route: '/daily' }
    : null;
  const next = pickNextDiscovery(summary, todayStamp);
  const { level } = xpProgress(progress.xp);

  // Chapter numerals follow the on-screen order of the stamp pages (the
  // "next" suggestion isn't a chapter), so they always read I, II, III, IV.
  const passport = buildPassport(regions ?? [], progress.visitedRegionIds, progress.regionVisitDates, (id) => natureSiteImages[id], language);
  const collectionEntries = collections.map((collection) => ({ collection, progress: computeCollectionProgress(collection, collectionSignals) }));
  const trailEntries = trails.map((trail) => ({ trail, progress: computeTrailProgress(trail, trailSignals) }));

  // Passport and Collections are their own kinds of page, not numbered
  // chapters - numerals stay I-IV on the four stamp chapters.
  const chapterPages: JourneySectionId[] = getJourneySectionOrder(experience).filter(
    (id) => id !== 'next' && id !== 'passport' && id !== 'collections' && id !== 'trails' && id !== 'learning',
  );
  const chapterOf = (id: JourneySectionId) => CHAPTER_NUMERALS[chapterPages.indexOf(id)] ?? '';

  const totalPossible =
    summary.discovered.experiences.length +
    summary.discovered.dailyItems.length +
    summary.explored.regionsTotal +
    summary.explored.discoveriesTotal +
    summary.played.total +
    summary.achievements.total;

  function renderStamps(
    stamps: JourneyStampData[],
    { withDates = false, tone = 'light', fallbackIcon }: { withDates?: boolean; tone?: 'light' | 'dark'; fallbackIcon?: LucideIcon } = {},
  ) {
    return (
      <StampGrid stampSize={stampSize}>
        {(slotWidth) =>
          stamps.map((stamp, index) => (
            <JourneyStamp
              key={stamp.id}
              stamp={withDates && stamp.detail ? { ...stamp, detail: formatDayLabel(stamp.detail, language) } : stamp}
              size={stampSize}
              slotWidth={slotWidth}
              index={index}
              tone={tone}
              fallbackIcon={fallbackIcon}
              showDetail={!isChild}
              onPress={stamp.route ? () => go(stamp.route) : undefined}
            />
          ))
        }
      </StampGrid>
    );
  }

  function renderSection(id: JourneySectionId) {
    switch (id) {
      case 'next':
        return <NextDiscoveryCard key={id} next={next} />;
      case 'passport':
        return <PassportSection key={id} passport={passport} experience={experience} />;
      case 'trails':
        return <TrailsJourneySection key={id} entries={trailEntries} editorial={isAdult} />;
      case 'learning':
        return <LearningJourneySection key={id} editorial={isAdult} />;
      case 'journal':
        return <JournalJourneySection key={id} editorial={isAdult} />;
      case 'collections':
        return <CollectionsJourneySection key={id} entries={collectionEntries} editorial={isAdult} />;
      case 'discovered':
        return (
          <JourneyPage
            key={id}
            icon={Sparkles}
            chapter={chapterOf('discovered')}
            tone="paper"
            title={t('journey.discovered.title')}
            earned={summary.discovered.earned}
            total={summary.discovered.experiences.length + summary.discovered.dailyItems.length}
            showBar={showProgressBars}
            editorial={isAdult}
            emptyHint={summary.discovered.earned === 0 ? t('journey.discovered.empty') : null}
            note={!isChild && summary.discovered.cultureDiscoveryCount > 0 ? t('journey.discovered.cultureCount', { count: summary.discovered.cultureDiscoveryCount }) : null}
          >
            <Text style={styles.subheading}>{t('culture.interactive.title')}</Text>
            {renderStamps(summary.discovered.experiences)}
            {summary.discovered.dailyItems.length > 0 ? (
              <>
                <Text style={styles.subheading}>{t('journey.discovered.daily')}</Text>
                {renderStamps(summary.discovered.dailyItems, { withDates: true })}
              </>
            ) : null}
          </JourneyPage>
        );
      case 'explored':
        return (
          <JourneyPage
            key={id}
            icon={Compass}
            chapter={chapterOf('explored')}
            tone="warm"
            title={t('journey.explored.title')}
            earned={summary.explored.regionsVisited + summary.explored.discoveriesFound}
            total={summary.explored.regionsTotal + summary.explored.discoveriesTotal}
            showBar={showProgressBars}
            editorial={isAdult}
            emptyHint={summary.explored.regionsVisited + summary.explored.discoveriesFound === 0 ? t('journey.explored.empty') : null}
            note={null}
          >
            {summary.explored.regions.length > 0 ? (
              <>
                <Text style={styles.subheading}>
                  {t('journey.explored.regions')} · {summary.explored.regionsVisited}/{summary.explored.regionsTotal}
                </Text>
                {renderStamps(summary.explored.regions)}
              </>
            ) : null}
            {summary.explored.discoveries.length > 0 ? (
              <>
                <Text style={styles.subheading}>
                  {t('journey.explored.discoveries')} · {summary.explored.discoveriesFound}/{summary.explored.discoveriesTotal}
                </Text>
                {renderStamps(summary.explored.discoveries)}
              </>
            ) : null}
          </JourneyPage>
        );
      case 'played':
        return (
          <JourneyPage
            key={id}
            icon={Gamepad2}
            chapter={chapterOf('played')}
            tone="paper"
            title={t('journey.played.title')}
            earned={summary.played.distinctPlayed}
            total={summary.played.total}
            showBar={showProgressBars}
            editorial={isAdult}
            emptyHint={summary.played.distinctPlayed === 0 ? t('journey.played.empty') : null}
            note={!isChild && summary.played.sessions > 0 ? t('journey.played.sessions', { count: summary.played.sessions }) : null}
          >
            {renderStamps(summary.played.games, { fallbackIcon: Gamepad2 })}
          </JourneyPage>
        );
      case 'achievements':
        return (
          <JourneyPage
            key={id}
            icon={Medal}
            chapter={chapterOf('achievements')}
            tone="feature"
            title={t('journey.achievements.title')}
            earned={summary.achievements.unlocked}
            total={summary.achievements.total}
            showBar={showProgressBars}
            editorial={isAdult}
            emptyHint={summary.achievements.unlocked === 0 ? t('journey.achievements.empty') : null}
            note={null}
          >
            {renderStamps(summary.achievements.stamps, { tone: 'dark' })}
          </JourneyPage>
        );
    }
  }

  const counters: { id: string; icon: LucideIcon; label: string; value: number }[] = [
    { id: 'discovered', icon: Sparkles, label: t('journey.counters.discovered'), value: summary.discovered.earned },
    { id: 'explored', icon: Compass, label: t('journey.counters.explored'), value: summary.explored.regionsVisited + summary.explored.discoveriesFound },
    { id: 'played', icon: Gamepad2, label: t('journey.counters.played'), value: summary.played.distinctPlayed },
    { id: 'achievements', icon: Medal, label: t('journey.counters.achievements'), value: summary.achievements.unlocked },
  ];

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.xl }]}
      >
        <View style={styles.header}>
          <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        </View>

        <HeroEntrance>
          <View style={styles.passport}>
            <Image source={journeyBackdrop} style={styles.passportBackdrop} resizeMode="cover" />
            <View style={styles.passportFrame} pointerEvents="none" />

            <View style={styles.passportTop}>
              <OymoOrnament size={14} color={colors.accentGold} strokeWidth={1.5} />
              <Text style={styles.passportOverline}>OYNO</Text>
              <OymoOrnament size={14} color={colors.accentGold} strokeWidth={1.5} />
            </View>

            <Text style={[styles.passportTitle, isAdult && styles.passportTitleEditorial]}>{t('journey.title')}</Text>
            <Text style={styles.passportSubtitle}>{t(`journey.subtitle.${experience}`)}</Text>

            <View style={styles.passportIdentity}>
              <Text style={styles.passportName} numberOfLines={1}>
                {user?.name ?? t('common.guestName')}
              </Text>
              <Text style={styles.passportLevel}>{t('journey.level', { level })}</Text>
            </View>

            <View style={styles.totalBlock}>
              <Text style={styles.totalValue}>{summary.totalStamps}</Text>
              <Text style={styles.totalLabel}>{t('journey.stampsLabel')}</Text>
            </View>
            {totalPossible > 0 ? (
              <View style={styles.summaryBar}>
                <ProgressBar progress={summary.totalStamps / totalPossible} height={4} fillColor={colors.accentGold} trackColor="rgba(255,255,255,0.14)" />
                <Text style={styles.summaryText}>{t('journey.summary', { earned: summary.totalStamps, total: totalPossible })}</Text>
              </View>
            ) : null}

            <View style={styles.counterRow}>
              {counters.map(({ id, icon: Icon, label, value }) => (
                <View key={id} style={styles.counter}>
                  <Icon size={isChild ? 22 : 18} color={colors.accentGold} strokeWidth={1.75} />
                  <Text style={[styles.counterValue, isChild && styles.counterValueChild]}>{value}</Text>
                  <Text style={styles.counterLabel} numberOfLines={1}>
                    {label}
                  </Text>
                </View>
              ))}
            </View>

            {!isSignedIn ? <Text style={styles.guestNote}>{t('journey.guestNote')}</Text> : null}
          </View>
        </HeroEntrance>

        <AgeExperienceTransition style={styles.sections}>
          {getJourneySectionOrder(experience).map((id, index) => (
            <FadeSlideIn key={id} index={index} staggerMs={50}>
              {renderSection(id)}
            </FadeSlideIn>
          ))}
        </AgeExperienceTransition>
      </ScrollView>
    </View>
  );
}

/** Measures its width and splits it into equal slots, so every row of
 * stamps spreads edge to edge instead of bunching left with a ragged gap -
 * at 375, 390 and 430 alike. */
function StampGrid({ stampSize, children }: { stampSize: number; children: (slotWidth: number | undefined) => ReactNode }) {
  const [width, setWidth] = useState(0);
  const minSlot = stampSize + spacing.sm;
  const columns = width > 0 ? Math.max(2, Math.floor(width / minSlot)) : 0;
  const slotWidth = columns > 0 ? Math.floor(width / columns) : undefined;

  return (
    <View style={styles.stampGrid} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {children(slotWidth)}
    </View>
  );
}

type JourneyPageProps = {
  icon: LucideIcon;
  /** Roman numeral - each stamp page is a chapter of the journal. */
  chapter: string;
  /** `paper`: plain cream journal page. `warm`: the sand-toned "map" page
   * (Explore). `feature`: the deep-green page the medals are pressed onto -
   * so consecutive chapters never look like the same box repeated. */
  tone: 'paper' | 'warm' | 'feature';
  title: string;
  earned: number;
  total: number;
  showBar: boolean;
  editorial: boolean;
  emptyHint: string | null;
  note: string | null;
  children: ReactNode;
};

/** One journal chapter - a numbered header with an oymo seal, a dashed
 * "stitch", then its stamps. Tone varies per chapter (see `tone`). */
function JourneyPage({ icon: Icon, chapter, tone, title, earned, total, showBar, editorial, emptyHint, note, children }: JourneyPageProps) {
  const isFeature = tone === 'feature';
  return (
    <View style={[styles.page, tone === 'warm' && styles.pageWarm, isFeature && styles.pageFeature]}>
      <View style={styles.pageHeader}>
        <View style={[styles.chapterSeal, isFeature && styles.chapterSealFeature]}>
          <Text style={[styles.chapterText, isFeature && styles.chapterTextFeature]}>{chapter}</Text>
        </View>
        <View style={styles.pageHeaderText}>
          <View style={styles.pageKicker}>
            <Icon size={13} color={isFeature ? colors.accentGold : colors.accentTerracotta} strokeWidth={2.25} />
            {total > 0 ? (
              <Text style={[styles.pageCount, isFeature && styles.pageCountFeature]}>
                {earned} / {total}
              </Text>
            ) : null}
          </View>
          <Text style={[styles.pageTitle, editorial && styles.pageTitleEditorial, isFeature && styles.pageTitleFeature]}>{title}</Text>
        </View>
      </View>
      {showBar && total > 0 ? (
        <ProgressBar
          progress={earned / total}
          height={5}
          fillColor={colors.accentGold}
          trackColor={isFeature ? 'rgba(255,255,255,0.14)' : 'rgba(139,107,61,0.18)'}
        />
      ) : null}
      <View style={[styles.stitch, isFeature && styles.stitchFeature]} />
      {emptyHint ? <Text style={[styles.pageHint, editorial && styles.pageHintEditorial, isFeature && styles.pageHintFeature]}>{emptyHint}</Text> : null}
      {note ? <Text style={[styles.pageNote, editorial && styles.pageHintEditorial]}>{note}</Text> : null}
      {children}
    </View>
  );
}

function NextDiscoveryCard({ next }: { next: NextDiscovery | null }) {
  const { t } = useTranslation();

  if (!next) {
    return (
      <View style={[styles.nextCard, styles.nextCardDone]}>
        <OymoOrnament size={16} color={colors.accentGold} strokeWidth={1.5} />
        <Text style={styles.nextDoneText}>{t('journey.next.allDone')}</Text>
      </View>
    );
  }

  const kindLabel =
    next.kind === 'daily'
      ? t('daily.entry.title')
      : next.kind === 'experience'
        ? t('culture.interactive.title')
        : next.kind === 'game'
          ? t('saved.contentTypes.game')
          : t('saved.contentTypes.region');

  return (
    <View style={styles.nextWrap}>
      <Text style={styles.nextHeading}>{t('journey.next.title')}</Text>
      <AnimatedPressable
        style={styles.nextCard}
        onPress={() => go(next.stamp.route)}
        pressScale={0.98}
        hoverEffect
        haptic="light"
        accessibilityRole="button"
        accessibilityLabel={`${t('journey.next.title')}: ${next.stamp.title}`}
      >
        {next.stamp.imageSource ? (
          <Image source={next.stamp.imageSource} style={styles.nextImage} resizeMode="cover" />
        ) : (
          <View style={[styles.nextImage, styles.nextImageFallback]}>
            <Compass size={28} color={colors.accentGold} strokeWidth={1.5} />
          </View>
        )}
        <View style={styles.nextBody}>
          <Text style={styles.nextKind}>{kindLabel}</Text>
          <Text style={styles.nextTitle} numberOfLines={2}>
            {next.stamp.title}
          </Text>
          <View style={styles.nextCta}>
            <Text style={styles.nextCtaLabel}>{t('journey.next.cta')}</Text>
            <ArrowRight size={13} color={colors.textPrimary} strokeWidth={2.5} />
          </View>
        </View>
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.md,
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
  },
  passport: {
    backgroundColor: colors.surfaceFeature,
    borderRadius: radii.xxl,
    padding: spacing.lg,
    overflow: 'hidden',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  passportBackdrop: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
    opacity: 0.16,
  },
  // Inset gold hairline - the "passport cover" edge.
  passportFrame: {
    position: 'absolute',
    top: spacing.xs,
    left: spacing.xs,
    right: spacing.xs,
    bottom: spacing.xs,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(232,185,61,0.45)',
  },
  passportTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  passportOverline: {
    ...typography.overline,
    color: colors.accentGold,
    letterSpacing: 4,
  },
  passportTitle: {
    ...typography.display,
    fontSize: 28,
    color: colors.textOnDark,
    textAlign: 'center',
  },
  passportTitleEditorial: {
    fontFamily: fontFamily.wordmark,
  },
  passportSubtitle: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
  },
  passportIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.08)',
    maxWidth: '100%',
  },
  passportName: {
    ...typography.caption,
    color: colors.textOnDark,
    fontWeight: '700',
    flexShrink: 1,
  },
  passportLevel: {
    ...typography.small,
    color: colors.accentGold,
  },
  totalBlock: {
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  totalValue: {
    fontFamily: fontFamily.wordmark,
    fontSize: 52,
    fontWeight: '700',
    color: colors.accentGold,
    lineHeight: 58,
  },
  totalLabel: {
    ...typography.overline,
    color: 'rgba(255,255,255,0.8)',
  },
  counterRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(232,185,61,0.35)',
  },
  counter: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  counterValue: {
    ...typography.h2,
    color: colors.textOnDark,
  },
  counterValueChild: {
    fontSize: 22,
  },
  counterLabel: {
    ...typography.small,
    color: 'rgba(255,255,255,0.7)',
  },
  guestNote: {
    ...typography.small,
    color: 'rgba(255,255,255,0.7)',
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  sections: {
    gap: spacing.lg,
  },
  summaryBar: {
    alignSelf: 'stretch',
    gap: spacing.xxs,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  summaryText: {
    ...typography.small,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  // Plain paper chapters sit straight on the screen's cream - no card
  // chrome - so only the warm/feature chapters read as distinct surfaces.
  page: {
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  pageWarm: {
    backgroundColor: colors.surfaceWarm,
    borderRadius: radii.xl,
    padding: spacing.md,
  },
  pageFeature: {
    backgroundColor: colors.surfaceFeature,
    borderRadius: radii.xl,
    padding: spacing.md,
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pageHeaderText: {
    flex: 1,
  },
  pageKicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  chapterSeal: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: colors.accentGoldPressed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterSealFeature: {
    borderColor: colors.accentGold,
  },
  chapterText: {
    fontFamily: fontFamily.wordmark,
    fontSize: 15,
    fontWeight: '700',
    color: colors.accentBrown,
  },
  chapterTextFeature: {
    color: colors.accentGold,
  },
  pageTitle: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  pageTitleEditorial: {
    fontFamily: fontFamily.wordmark,
  },
  pageTitleFeature: {
    color: colors.textOnDark,
  },
  pageCount: {
    ...typography.small,
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  pageCountFeature: {
    color: 'rgba(255,255,255,0.7)',
  },
  // A dashed "stitch" line under the page header - passport-page detail.
  stitch: {
    height: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  stitchFeature: {
    borderColor: 'rgba(232,185,61,0.35)',
  },
  pageHintFeature: {
    color: 'rgba(255,255,255,0.75)',
  },
  pageHint: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  pageHintEditorial: {
    fontFamily: fontFamily.wordmark,
    fontStyle: 'italic',
    fontSize: 14,
  },
  pageNote: {
    ...typography.caption,
    color: colors.accentTerracotta,
  },
  subheading: {
    ...typography.overline,
    color: colors.textMuted,
    marginTop: spacing.xxs,
  },
  stampGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.md,
  },
  nextWrap: {
    gap: spacing.sm,
  },
  nextHeading: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  nextCard: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceWarm,
    borderRadius: radii.xl,
    overflow: 'hidden',
    minHeight: 116,
  },
  nextCardDone: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    minHeight: 0,
  },
  nextDoneText: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  nextImage: {
    width: '34%',
    minHeight: 116,
    height: '100%',
    backgroundColor: colors.surfaceAlt,
  },
  nextImageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceFeature,
  },
  nextBody: {
    flex: 1,
    padding: spacing.md,
    justifyContent: 'center',
    gap: 2,
  },
  nextKind: {
    ...typography.overline,
    color: colors.accentTerracotta,
  },
  nextTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  nextCta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xxs,
    backgroundColor: colors.accentGold,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.pill,
    marginTop: spacing.xs,
  },
  nextCtaLabel: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '700',
  },
});
