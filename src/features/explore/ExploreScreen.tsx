import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import { useProgressStore } from '@/store/useProgressStore';
import { colors, spacing } from '@/theme';

import {
  CurrentQuestCard,
  DiscoveriesRow,
  ExploreHeader,
  KyrgyzstanMap,
  RegionProgressCard,
} from './components';
import { exploreCurrentQuest, exploreDiscoveries, exploreMapPins, exploreProgress, getExploreLocationById } from './data';
import type { ExploreDiscovery } from './types';

const mapPins = exploreMapPins.map((pin) => {
  const location = getExploreLocationById(pin.locationId);
  return {
    id: pin.locationId,
    label: location?.name.kg ?? pin.locationId,
    xPercent: pin.xPercent,
    yPercent: pin.yPercent,
  };
});

export function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const progress = useProgressStore();

  const quest = {
    ...exploreCurrentQuest,
    foundCount: progress.questFoundCount,
    ctaLabel: progress.questCompleted ? 'Квест аткарылды!' : exploreCurrentQuest.ctaLabel,
  };

  function handlePressQuest() {
    useProgressStore.getState().advanceQuest();
  }

  function handlePressDiscovery(discovery: ExploreDiscovery) {
    useProgressStore.getState().discoverExploreItem(discovery.id);
  }

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm }]}
      >
        <ExploreHeader
          onPressAvatar={() => router.push('/character-select' as never)}
          onPressCollection={() => router.push('/collection' as never)}
        />

        <View style={styles.horizontalPad}>
          <KyrgyzstanMap
            pins={mapPins}
            onPressPin={(locationId) => router.push(`/explore/${locationId}` as never)}
            onPressLocate={() => {}}
            onPressFilter={() => router.push('/collection' as never)}
          />
        </View>

        <View style={styles.horizontalPad}>
          <RegionProgressCard progress={exploreProgress} />
        </View>

        <View style={styles.horizontalPad}>
          <CurrentQuestCard quest={quest} onPress={handlePressQuest} />
        </View>

        <DiscoveriesRow
          discoveries={exploreDiscoveries}
          discoveredIds={progress.discoveredExploreIds}
          onPressDiscovery={handlePressDiscovery}
          onPressSeeAll={() => router.push('/collection' as never)}
        />
      </ScrollView>

      <View style={{ paddingBottom: insets.bottom }}>
        <BottomTabBar
          activeTab="explore"
          onPressTab={(tab) => {
            if (tab === 'home') router.push('/home');
            if (tab === 'games') router.push('/games' as never);
            if (tab === 'culture') router.push('/culture' as never);
            if (tab === 'profile') router.push('/profile' as never);
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
