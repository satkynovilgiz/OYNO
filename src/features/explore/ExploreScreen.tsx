import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import { colors, spacing } from '@/theme';

import { ExploreHeader, LocationsSection, OverallProgressCard, QuestComingSoonCard } from './components';
import { exploreLocations } from './data';
import type { ExploreLocation } from './types';

const regions = exploreLocations.filter((location) => location.kind === 'region');
const natureSites = exploreLocations.filter((location) => location.kind === 'nature');

const discoveredCount = exploreLocations.filter((location) => location.discoveredPercent > 0).length;
const overallPercent = Math.round(
  exploreLocations.reduce((sum, location) => sum + location.discoveredPercent, 0) /
    exploreLocations.length,
);

export function ExploreScreen() {
  const insets = useSafeAreaInsets();

  const handlePressLocation = (location: ExploreLocation) => {
    router.push(`/explore/${location.id}` as never);
  };

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm }]}
      >
        <ExploreHeader />

        <View style={styles.horizontalPad}>
          <OverallProgressCard
            discoveredLocations={discoveredCount}
            totalLocations={exploreLocations.length}
            overallPercent={overallPercent}
          />
        </View>

        <View style={styles.horizontalPad}>
          <QuestComingSoonCard />
        </View>

        <LocationsSection title="Аймактар" locations={regions} onPressLocation={handlePressLocation} />
        <LocationsSection
          title="Жаратылыш"
          locations={natureSites}
          onPressLocation={handlePressLocation}
        />
      </ScrollView>

      <View style={{ paddingBottom: insets.bottom }}>
        <BottomTabBar
          activeTab="explore"
          onPressTab={(tab) => {
            if (tab === 'home') router.push('/');
            if (tab === 'games') router.push('/games' as never);
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
});
