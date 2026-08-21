import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabBar } from '@/components/navigation/BottomTabBar';
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
  achievementsUnlocked,
  collectionTotal,
  collectionUnlocked,
  dailyActivity,
  dailyActivityCompleted,
  dailyActivityTotal,
  dailyReward,
  favoriteGames,
  mockProfile,
  profileAchievements,
  profileCollection,
  profileStats,
} from './data';

const mockHasUnreadNotifications = true;

export function ProfileScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm }]}
      >
        <ProfileHeader
          hasUnreadNotifications={mockHasUnreadNotifications}
          onPressBack={() => router.back()}
          onPressSettings={() => console.log('navigate: profile settings')}
          onPressNotifications={() => console.log('navigate: notifications')}
        />

        <View style={styles.horizontalPad}>
          <ProfileHero
            profile={mockProfile}
            onPressAvatar={() => router.push('/character-select' as never)}
            onPressEdit={() => console.log('navigate: edit profile')}
          />
        </View>

        <View style={styles.horizontalPad}>
          <XpProgressCard profile={mockProfile} />
        </View>

        <CurrencyRow profile={mockProfile} />

        <View style={styles.horizontalPad}>
          <ProfileStatsGrid stats={profileStats} />
        </View>

        <View style={[styles.horizontalPad, styles.row]}>
          <AchievementsPreviewCard
            achievements={profileAchievements}
            unlocked={achievementsUnlocked}
            total={achievementsTotal}
            onPressSeeAll={() => console.log('navigate: all achievements')}
          />
          <FavoriteGamesCard
            games={favoriteGames}
            onPressSeeAll={() => router.push('/games' as never)}
            onPressGame={(game) => console.log('navigate: game detail', game.id)}
          />
        </View>

        <ProfileCollectionRow
          items={profileCollection}
          onPressItem={(item) => console.log('navigate: collection item', item.id)}
          onPressSeeAll={() => console.log('navigate: full collection')}
        />

        <View style={[styles.horizontalPad, styles.row]}>
          <DailyActivitySummaryCard
            profile={mockProfile}
            activity={dailyActivity}
            completed={dailyActivityCompleted}
            total={dailyActivityTotal}
          />
          <DailyRewardCard reward={dailyReward} onPressClaim={() => console.log('claim: daily reward')} />
        </View>
      </ScrollView>

      <View style={{ paddingBottom: insets.bottom }}>
        <BottomTabBar
          activeTab="profile"
          onPressTab={(tab) => {
            if (tab === 'home') router.push('/');
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
