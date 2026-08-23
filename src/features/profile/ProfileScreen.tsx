import { router } from 'expo-router';
import { Backpack, Compass, Diamond, Gamepad2, Target } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import { mockGamesList } from '@/features/games/mockData';
import { xpProgress } from '@/services/progress/levelConfig';
import { useAppStore } from '@/store/useAppStore';
import { useTrackScreenView } from '@/services/analytics/useTrackScreenView';
import { useAuthStore } from '@/store/useAuthStore';
import { useNotificationsStore } from '@/store/useNotificationsStore';
import { DAILY_GIFT_REWARD, useProgressStore } from '@/store/useProgressStore';
import { colors, spacing } from '@/theme';

import {
  AchievementsPreviewCard,
  CurrencyRow,
  DailyActivitySummaryCard,
  DailyRewardCard,
  FavoriteGamesCard,
  ProfileCollectionRow,
  ProfileHeader,
  ProfileHero,
  ProfileStatsGrid,
  XpProgressCard,
} from './components';
import {
  achievementsTotal,
  collectionTotal,
  collectionUnlocked,
  profileAchievements,
  profileCollection,
} from './data';
import type { DailyActivityItem, FavoriteGame, ProfileStat, ProfileSummary } from './types';

const QUEST_TOTAL = 5;

export function ProfileScreen() {
  useTrackScreenView('profile');
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const hasUnreadNotifications = useNotificationsStore((state) => state.hasUnread());
  const user = useAuthStore((state) => state.user);
  const characterId = useAppStore((state) => state.characterId) ?? 'bek';
  const progress = useProgressStore();

  const today = new Date().toISOString().slice(0, 10);
  const giftClaimed = progress.dailyGiftClaimedDateISO === today;

  const { level, xpCurrent, xpMax } = xpProgress(progress.xp);
  const profile: ProfileSummary = {
    characterId,
    name: user?.name ?? t('common.guestName'),
    level,
    title: t('profile.rankTitle'),
    xpCurrent,
    xpMax,
    coins: progress.coins,
    badges: progress.unlockedAchievementIds.length,
    tokens: progress.gems,
    streakDays: progress.streakDays,
  };

  const explorePercent = Math.round((progress.questFoundCount / QUEST_TOTAL) * 100);
  const cultureRatio = ((progress.cultureDiscoveryCount >= 1 ? 1 : 0) + (progress.bozUyVisited ? 1 : 0)) / 2;

  const profileStats: ProfileStat[] = [
    { id: 'games', icon: Gamepad2, label: t('profile.stats.games'), valueLabel: String(progress.gamesPlayed), captionKey: 'count', ringProgress: Math.min(1, progress.gamesPlayed / 20) },
    { id: 'explore', icon: Compass, label: t('profile.stats.explore'), valueLabel: `${explorePercent}%`, captionKey: 'percent', ringProgress: progress.questFoundCount / QUEST_TOTAL },
    { id: 'culture', icon: Diamond, label: t('profile.stats.culture'), valueLabel: `${Math.round(cultureRatio * 100)}%`, captionKey: 'percent', ringProgress: cultureRatio },
    { id: 'quests', icon: Target, label: t('profile.stats.quests'), valueLabel: `${progress.questFoundCount} / ${QUEST_TOTAL}`, captionKey: 'fraction', ringProgress: progress.questFoundCount / QUEST_TOTAL },
    { id: 'collection', icon: Backpack, label: t('profile.stats.collection'), valueLabel: `${collectionUnlocked} / ${collectionTotal}`, captionKey: 'fraction', ringProgress: collectionUnlocked / collectionTotal },
  ];

  const favoriteGames: FavoriteGame[] = mockGamesList
    .filter((game) => (progress.gameStats[game.id]?.played ?? 0) > 0)
    .map((game) => ({
      id: game.id,
      name: game.name,
      thumbnail: game.thumbnail,
      gamesPlayed: progress.gameStats[game.id].played,
      wins: progress.gameStats[game.id].won,
      route: game.route,
    }));

  const dailyActivity: DailyActivityItem[] = [
    {
      id: 'games',
      icon: Gamepad2,
      label:
        progress.playsToday > 0
          ? t('profile.dailyActivity.games.played', { count: progress.playsToday })
          : t('profile.dailyActivity.games.empty'),
    },
    {
      id: 'discovery',
      icon: Diamond,
      label:
        progress.cultureDiscoveryCount >= 1
          ? t('profile.dailyActivity.discovery.found')
          : t('profile.dailyActivity.discovery.empty'),
    },
    {
      id: 'quests',
      icon: Target,
      label: t('profile.dailyActivity.quests', { found: progress.questFoundCount, total: QUEST_TOTAL }),
    },
    {
      id: 'boz-uy',
      icon: Compass,
      label: progress.bozUyVisited
        ? t('profile.dailyActivity.bozUy.visited')
        : t('profile.dailyActivity.bozUy.notVisited'),
    },
  ];
  const dailyActivityCompleted = [
    progress.playsToday > 0,
    progress.cultureDiscoveryCount >= 1,
    progress.questFoundCount > 0,
    progress.bozUyVisited,
  ].filter(Boolean).length;

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm }]}
      >
        <ProfileHeader
          hasUnreadNotifications={hasUnreadNotifications}
          onPressBack={() => router.back()}
          onPressSettings={() => router.push('/settings' as never)}
          onPressNotifications={() => router.push('/notifications' as never)}
        />

        <View style={styles.horizontalPad}>
          <ProfileHero
            profile={profile}
            onPressAvatar={() => router.push('/character-select' as never)}
            onPressEdit={() => router.push('/settings/account' as never)}
          />
        </View>

        <View style={styles.horizontalPad}>
          <XpProgressCard profile={profile} />
        </View>

        <CurrencyRow profile={profile} />

        <View style={styles.horizontalPad}>
          <ProfileStatsGrid stats={profileStats} />
        </View>

        <View style={[styles.horizontalPad, styles.row]}>
          <AchievementsPreviewCard
            achievements={profileAchievements}
            unlockedIds={progress.unlockedAchievementIds}
            unlocked={progress.unlockedAchievementIds.length}
            total={achievementsTotal}
            onPressSeeAll={() => router.push('/achievements' as never)}
          />
          <FavoriteGamesCard
            games={favoriteGames}
            onPressSeeAll={() => router.push('/games' as never)}
            onPressGame={(game) => {
              if (game.route) router.push(game.route as never);
            }}
          />
        </View>

        <ProfileCollectionRow
          items={profileCollection}
          onPressItem={() => router.push('/collection' as never)}
          onPressSeeAll={() => router.push('/collection' as never)}
        />

        <View style={[styles.horizontalPad, styles.row]}>
          <DailyActivitySummaryCard
            profile={profile}
            activity={dailyActivity}
            completed={dailyActivityCompleted}
            total={dailyActivity.length}
          />
          <DailyRewardCard
            reward={DAILY_GIFT_REWARD}
            claimed={giftClaimed}
            onPressClaim={() => useProgressStore.getState().claimDailyGift()}
          />
        </View>
      </ScrollView>

      <View style={{ paddingBottom: insets.bottom }}>
        <BottomTabBar
          activeTab="profile"
          onPressTab={(tab) => {
            if (tab === 'home') router.push('/home');
            if (tab === 'games') router.push('/games' as never);
            if (tab === 'explore') router.push('/explore' as never);
            if (tab === 'culture') router.push('/culture' as never);
          }}
        />
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
  horizontalPad: {
    paddingHorizontal: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
