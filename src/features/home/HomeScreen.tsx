import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';

import {
  BottomTabBar,
  CultureGrid,
  DailyChallengeCard,
  DailyGiftCard,
  GamesCarousel,
  HeroBanner,
  HomeHeader,
  ProfileSummaryCard,
} from './components';
import {
  mockCultureTiles,
  mockDailyChallenge,
  mockDailyGift,
  mockGames,
  mockHasUnreadNotifications,
  mockPlayer,
} from './mockData';

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

        <GamesCarousel games={mockGames} />

        <CultureGrid tiles={mockCultureTiles} />
      </ScrollView>

      <View style={{ paddingBottom: insets.bottom }}>
        <BottomTabBar />
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
