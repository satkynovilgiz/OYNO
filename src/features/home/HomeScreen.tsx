import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabBar, type TabId } from '@/components/navigation/BottomTabBar';
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
import {
  mockCultureTiles,
  mockDailyChallenge,
  mockDailyGift,
  mockDailyProgress,
  mockGames,
  mockHasUnreadNotifications,
  mockPlayer,
} from './mockData';

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
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm }]}
      >
        <HomeHeader hasUnreadNotifications={mockHasUnreadNotifications} />

        <View style={styles.topRow}>
          <ProfileSummaryCard player={mockPlayer} />
          <DailyChallengeCard challenge={mockDailyChallenge} />
        </View>

        <View style={styles.horizontalPad}>
          <DailyGiftCard gift={mockDailyGift} />
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

        <CultureGrid tiles={mockCultureTiles} />

        <View style={styles.horizontalPad}>
          <DailyProgressCard progress={mockDailyProgress} />
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
