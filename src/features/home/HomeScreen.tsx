import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabBar, type TabId } from '@/components/navigation/BottomTabBar';
import { useTrackScreenView } from '@/services/analytics/useTrackScreenView';
import { xpProgress } from '@/services/progress/levelConfig';
import { useAppStore } from '@/store/useAppStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useAvatarStore } from '@/store/useAvatarStore';
import { useNotificationsStore } from '@/store/useNotificationsStore';
import { DAILY_PLAY_GOAL, useProgressStore } from '@/store/useProgressStore';
import { colors, spacing } from '@/theme';

import {
  CultureGrid,
  DailyChallengeCard,
  DailyGiftCard,
  DailyProgressCard,
  GamesCarousel,
  HeroBanner,
  HomeHeader,
  ProfileSummaryCard,
} from './components';
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
  const hasUnreadNotifications = useNotificationsStore((state) => state.hasUnread());
  const user = useAuthStore((state) => state.user);
  const characterId = useAppStore((state) => state.characterId) ?? 'bek';
  const avatarConfig = useAvatarStore((state) => (state.hasEverSaved ? state.config : null));
  const progress = useProgressStore();

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

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm }]}
      >
        <HomeHeader
          hasUnreadNotifications={hasUnreadNotifications}
          onPressMenu={() => router.push('/settings' as never)}
          onPressNotifications={() => router.push('/notifications' as never)}
        />

        <View style={styles.topRow}>
          <ProfileSummaryCard player={player} />
          <DailyChallengeCard challenge={dailyChallenge} onPress={handlePressDailyChallenge} />
        </View>

        <View style={styles.horizontalPad}>
          <DailyGiftCard gift={dailyGift} onPress={() => useProgressStore.getState().claimDailyGift()} />
        </View>

        <View style={styles.horizontalPad}>
          <HeroBanner />
        </View>

        <GamesCarousel
          games={mockGames}
          onPressGame={(game) => {
            if (game.route) {
              router.push(game.route as never);
            }
          }}
          onPressSeeAll={() => router.push('/games' as never)}
        />

        <CultureGrid tiles={cultureTiles} onPressTile={(tile) => router.push(routeForCultureTile(tile.id) as never)} />

        <View style={styles.horizontalPad}>
          <DailyProgressCard
            progress={dailyProgress}
            claimable={playComplete}
            claimed={playClaimed}
            onPressClaim={() => useProgressStore.getState().claimDailyPlay()}
          />
        </View>
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
  topRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  horizontalPad: {
    paddingHorizontal: spacing.md,
  },
});
