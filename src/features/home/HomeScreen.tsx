import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AgeExperienceTransition, FadeSlideIn, HeroEntrance, ScreenEntrance } from '@/components/ui';
import { BottomTabBar, type TabId } from '@/components/navigation/BottomTabBar';
import { useTrackScreenView } from '@/services/analytics/useTrackScreenView';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { useCurrentQuest } from '@/services/content/exploreService';
import { useDiscoveries } from '@/services/content/discoveriesService';
import { useQuestSteps } from '@/services/content/questStepsService';
import { xpProgress } from '@/services/progress/levelConfig';
import type { QuestStep } from '@/services/explore/questSteps';
import { useAppStore } from '@/store/useAppStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useAvatarStore } from '@/store/useAvatarStore';
import { useNotificationsStore } from '@/store/useNotificationsStore';
import { DAILY_PLAY_GOAL, useProgressStore } from '@/store/useProgressStore';
import { colors, spacing } from '@/theme';

import {
  ContinueJourneyCard,
  CultureGrid,
  DailyChallengeCard,
  DailyGiftCard,
  DailyProgressCard,
  GamesCarousel,
  HeroBanner,
  HomeHeader,
  ProfileSummaryCard,
} from './components';
import { resolveContinueJourney } from './continueJourney';
import { getHomeSectionOrder, type HomeSectionId } from './homeSections';
import { cultureTileAssets, mockGames } from './mockData';
import type { CultureTile, DailyChallenge, DailyGift, DailyProgress, PlayerSummary } from './types';

/** Home's own tile ids map onto Culture's category routes 1:1, except
 * "culture" (the hub itself) and "map" (a different feature entirely). */
function routeForCultureTile(tileId: string): string {
  if (tileId === 'culture') return '/culture';
  if (tileId === 'map') return '/explore';
  return `/culture/${tileId}`;
}

function handlePressTab(tab: TabId) {
  if (tab === 'games') {
    router.push('/games' as never);
  }
  if (tab === 'explore') {
    router.push('/explore' as never);
  }
  if (tab === 'culture') {
    router.push('/culture' as never);
  }
  if (tab === 'profile') {
    router.push('/profile' as never);
  }
}

export function HomeScreen() {
  useTrackScreenView('home');
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const hasUnreadNotifications = useNotificationsStore((state) => state.hasUnread());
  const user = useAuthStore((state) => state.user);
  const characterId = useAppStore((state) => state.characterId) ?? 'bek';
  const avatarConfig = useAvatarStore((state) => (state.hasEverSaved ? state.config : null));
  const progress = useProgressStore();
  const { data: questRow } = useCurrentQuest();
  const { data: questStepRows } = useQuestSteps(questRow?.id);
  const { data: discoveries } = useDiscoveries();

  const questSteps: QuestStep[] = (questStepRows ?? []).map((s) => ({
    id: s.id,
    questId: s.quest_id,
    stepOrder: s.step_order,
    stepType: s.step_type,
    targetId: s.target_id,
  }));
  const continueJourney = resolveContinueJourney(
    questRow ? { title: questRow.title, subtitle: questRow.subtitle, current: progress.questFoundCount, total: questRow.total_count, completed: progress.questCompleted } : null,
    questSteps,
    progress.completedQuestStepIds,
    (step) => (step.stepType === 'DISCOVER_ITEM' ? ((discoveries ?? []).find((d) => d.id === step.targetId)?.region_id ?? null) : null),
    {
      bozUyVisited: progress.bozUyVisited,
      oymoCreated: progress.oymoCreated,
      shyrdakCreated: progress.shyrdakCreated,
      komuzLessonCompleted: progress.komuzLessonCompleted,
    },
  );

  const today = new Date().toISOString().slice(0, 10);
  const challengeClaimed = progress.dailyChallengeClaimedDateISO === today;
  const challengeComplete = progress.winsToday >= 1;
  const giftClaimed = progress.dailyGiftClaimedDateISO === today;
  const playClaimed = progress.dailyPlayClaimedDateISO === today;
  const playComplete = progress.playsToday >= DAILY_PLAY_GOAL;

  const { level, xpCurrent, xpMax } = xpProgress(progress.xp);
  const player: PlayerSummary = {
    name: user?.name ?? t('common.guestName'),
    rank: t('home.profile.rank'),
    characterId,
    avatarConfig,
    level,
    xpCurrent,
    xpMax,
    coins: progress.coins,
    gems: progress.gems,
    streakDays: progress.streakDays,
  };

  const dailyChallenge: DailyChallenge = {
    description: t('home.dailyChallenge.description'),
    progressCurrent: Math.min(progress.winsToday, 1),
    progressMax: 1,
    rewardXp: 100,
    rewardCoins: 50,
  };

  const dailyGift: DailyGift = {
    subtitle: t(giftClaimed ? 'home.dailyGift.subtitleClaimed' : 'home.dailyGift.subtitleUnclaimed'),
  };

  const dailyProgress: DailyProgress = {
    description: t('home.dailyProgress.description', { played: Math.min(progress.playsToday, DAILY_PLAY_GOAL), goal: DAILY_PLAY_GOAL }),
    progressCurrent: Math.min(progress.playsToday, DAILY_PLAY_GOAL),
    progressMax: DAILY_PLAY_GOAL,
  };

  const cultureTiles: CultureTile[] = cultureTileAssets.map((asset) => ({
    id: asset.id,
    tone: asset.tone,
    imageSource: asset.imageSource,
    title: t(`home.cultureTiles.${asset.id}.title`),
    subtitle: t(`home.cultureTiles.${asset.id}.subtitle`),
  }));

  function handlePressDailyChallenge() {
    if (challengeComplete && !challengeClaimed) {
      useProgressStore.getState().claimDailyChallenge();
    } else {
      router.push('/games' as never);
    }
  }

  // Same six sections, same underlying data, for every AgeExperience - only
  // their order changes (spec "Make Home adapt to AgeExperience... Section
  // ordering/presentation responds to AgeExperience... do not duplicate
  // HomeScreen or change underlying progress/game logic").
  function renderSection(id: HomeSectionId) {
    switch (id) {
      case 'hero':
        return (
          <View key={id} style={styles.horizontalPad}>
            {continueJourney ? (
              <ContinueJourneyCard data={continueJourney} onPress={(route) => router.push(route as never)} />
            ) : (
              // Every quest and interactive experience genuinely completed
              // (spec "Avoid showing completed content as if it is new") -
              // nothing left to continue, so this falls back to the plain
              // illustrated banner rather than inventing a card.
              <HeroEntrance>
                <HeroBanner />
              </HeroEntrance>
            )}
          </View>
        );
      case 'profile':
        return (
          <View key={id} style={styles.horizontalPad}>
            <ProfileSummaryCard player={player} />
          </View>
        );
      case 'dailyRow':
        return (
          <View key={id} style={styles.topRow}>
            <DailyChallengeCard
              challenge={dailyChallenge}
              onPress={handlePressDailyChallenge}
              ready={challengeComplete && !challengeClaimed}
            />
            <DailyGiftCard gift={dailyGift} claimed={giftClaimed} onPress={() => useProgressStore.getState().claimDailyGift()} />
          </View>
        );
      case 'games':
        return (
          <GamesCarousel
            key={id}
            games={mockGames}
            onPressGame={(game) => {
              if (game.route) {
                router.push(game.route as never);
              }
            }}
            onPressSeeAll={() => router.push('/games' as never)}
          />
        );
      case 'culture':
        return (
          <CultureGrid key={id} tiles={cultureTiles} onPressTile={(tile) => router.push(routeForCultureTile(tile.id) as never)} />
        );
      case 'dailyProgress':
        return (
          <View key={id} style={styles.horizontalPad}>
            <DailyProgressCard
              progress={dailyProgress}
              claimable={playComplete}
              claimed={playClaimed}
              onPressClaim={() => useProgressStore.getState().claimDailyPlay()}
            />
          </View>
        );
    }
  }

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm }]}
      >
        <ScreenEntrance>
          <HomeHeader
            hasUnreadNotifications={hasUnreadNotifications}
            greetingName={user?.name}
            onPressMenu={() => router.push('/settings' as never)}
            onPressSearch={() => router.push('/search' as never)}
            onPressNotifications={() => router.push('/notifications' as never)}
          />
        </ScreenEntrance>

        <AgeExperienceTransition style={styles.sectionList}>
          {getHomeSectionOrder(experience).map((id, index) => (
            <FadeSlideIn key={id} index={index} staggerMs={40}>
              {renderSection(id)}
            </FadeSlideIn>
          ))}
        </AgeExperienceTransition>
      </ScrollView>

      <View style={{ paddingBottom: insets.bottom }}>
        <BottomTabBar activeTab="home" onPressTab={handlePressTab} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sectionList: {
    gap: spacing.lg,
  },
  topRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  horizontalPad: {
    paddingHorizontal: spacing.md,
  },
});
