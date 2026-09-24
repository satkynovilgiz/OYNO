import { router } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AgeExperienceTransition, FadeSlideIn, ScreenEntrance } from '@/components/ui';
import { BottomTabBar, type TabId } from '@/components/navigation/BottomTabBar';
import { track } from '@/services/analytics/analytics';
import { useTrackScreenView } from '@/services/analytics/useTrackScreenView';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { xpProgress } from '@/services/progress/levelConfig';
import { useTodayDiscovery } from '@/features/daily/useTodayDiscovery';
import { useAppStore } from '@/store/useAppStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useAvatarStore } from '@/store/useAvatarStore';
import { useNotificationsStore } from '@/store/useNotificationsStore';
import { DAILY_PLAY_GOAL, useProgressStore } from '@/store/useProgressStore';
import { colors, spacing } from '@/theme';

import {
  CategoryCarousel,
  GamesCarousel,
  HomeHeader,
  HomeJourneyCard,
  HomeProgressSection,
  HomeTodayPair,
  RecentlyExploredRow,
  TodayDiscoveryEntryCard,
} from './components';
import { getHomeSectionOrder, type HomeSectionId } from './homeSections';
import { cultureTileAssets } from './mockData';
import { mockGamesList } from '@/features/games/mockData';
import type { CultureTile, DailyChallenge, DailyGift, DailyProgress, PlayerSummary } from './types';
import { useHomeRecommendation } from './useHomeRecommendation';

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
  const { isLoading: todayLoading, discovery: todayDiscovery } = useTodayDiscovery();
  const { recommendation, display: recommendationDisplay, recent } = useHomeRecommendation();

  // Product analytics only: which kind of content was recommended/opened -
  // content type + id, never content text or user data.
  useEffect(() => {
    track('home_recommendation_shown', { contentType: recommendation.kind, contentId: recommendation.contentId ?? '' });
  }, [recommendation.kind, recommendation.contentId]);

  function openRecommendation() {
    track('home_recommendation_opened', { contentType: recommendation.kind, contentId: recommendation.contentId ?? '' });
    router.push(recommendation.route as never);
  }

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

  // One Home architecture for every age (homeSections.ts); the data and
  // actions below are exactly the existing ones - only presentation changed.
  function renderSection(id: HomeSectionId) {
    switch (id) {
      case 'hero':
        // The ONE primary recommendation (buildHomeJourneyRecommendation).
        return (
          <View key={id} style={styles.horizontalPad}>
            <HomeJourneyCard recommendation={recommendation} display={recommendationDisplay} onPress={openRecommendation} />
          </View>
        );
      case 'culture':
        return <CategoryCarousel key={id} tiles={cultureTiles} experience={experience} onPressTile={(tile) => router.push(routeForCultureTile(tile.id) as never)} />;
      case 'today':
        // Already the primary recommendation above - don't show Daily twice.
        if (recommendation.kind === 'daily') return null;
        return (
          <View key={id} style={styles.horizontalPad}>
            <TodayDiscoveryEntryCard discovery={todayDiscovery} isLoading={todayLoading} experience={experience} onPress={() => router.push('/daily' as never)} />
          </View>
        );
      case 'recent':
        return recent.length > 0 ? <RecentlyExploredRow key={id} items={recent} onPress={(route) => router.push(route as never)} /> : null;
      case 'progress':
        return (
          <HomeProgressSection
            key={id}
            player={player}
            dailyProgress={dailyProgress}
            claimable={playComplete}
            claimed={playClaimed}
            experience={experience}
            onPressClaim={() => useProgressStore.getState().claimDailyPlay()}
          />
        );
      case 'games':
        return (
          <GamesCarousel
            key={id}
            games={mockGamesList}
            experience={experience}
            onPressGame={(game) => {
              if (game.route) router.push(game.route as never);
            }}
            onPressSeeAll={() => router.push('/games' as never)}
          />
        );
      case 'dailyRow':
        return (
          <HomeTodayPair
            key={id}
            challenge={dailyChallenge}
            challengeReady={challengeComplete && !challengeClaimed}
            onPressChallenge={handlePressDailyChallenge}
            gift={dailyGift}
            giftClaimed={giftClaimed}
            onPressGift={() => useProgressStore.getState().claimDailyGift()}
          />
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
  // Rhythm: header -> hero 16; between major sections 28 (xl-ish), cards
  // inside a section 12 (see homeKit). Bottom padding keeps the last
  // section fully above the tab bar.
  content: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  sectionList: {
    gap: 28,
  },
  horizontalPad: {
    paddingHorizontal: spacing.md,
  },
});
