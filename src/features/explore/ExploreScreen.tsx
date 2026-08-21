import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import { colors, spacing } from '@/theme';

import {
  CurrentQuestCard,
  DiscoveriesRow,
  ExploreHeader,
  KyrgyzstanMap,
  RegionProgressCard,
} from './components';
import { exploreCurrentQuest, exploreDiscoveries, exploreMapPins, exploreProgress, getExploreLocationById } from './data';

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

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm }]}
      >
        <ExploreHeader
          onPressAvatar={() => router.push('/character-select' as never)}
          onPressSearch={() => console.log('navigate: explore search')}
          onPressCollection={() => console.log('navigate: collection screen')}
        />

        <View style={styles.horizontalPad}>
          <KyrgyzstanMap
            pins={mapPins}
            onPressPin={(locationId) => router.push(`/explore/${locationId}` as never)}
            onPressLocate={() => console.log('map: recenter')}
            onPressFilter={() => console.log('navigate: map filter')}
          />
        </View>

        <View style={styles.horizontalPad}>
          <RegionProgressCard progress={exploreProgress} />
        </View>

        <View style={styles.horizontalPad}>
          <CurrentQuestCard
            quest={exploreCurrentQuest}
            onPress={() => console.log('navigate: quest detail', exploreCurrentQuest.id)}
          />
        </View>

        <DiscoveriesRow
          discoveries={exploreDiscoveries}
          onPressDiscovery={(discovery) => console.log('navigate: discovery detail', discovery.id)}
          onPressSeeAll={() => console.log('navigate: collection screen')}
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
