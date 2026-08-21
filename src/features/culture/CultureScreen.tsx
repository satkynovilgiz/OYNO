import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import { useNotificationsStore } from '@/store/useNotificationsStore';
import { useProgressStore } from '@/store/useProgressStore';
import { colors, spacing } from '@/theme';

import {
  CultureCategoriesGrid,
  CultureHeader,
  CultureHero,
  CultureProgressCard,
  EnterBozUyCard,
  NewMaterialsRow,
  QuizTeaserCard,
  TodayDiscoveryCard,
} from './components';
import { cultureCategories, cultureNewMaterials, cultureProgress, cultureTodayDiscovery } from './data';
import type { CultureCategory } from './types';

function handlePressCategory(category: CultureCategory) {
  if (category.id === 'games') {
    router.push('/games' as never);
    return;
  }
  router.push('/collection' as never);
}

export function CultureScreen() {
  const insets = useSafeAreaInsets();
  const hasUnreadNotifications = useNotificationsStore((state) => state.hasUnread());
  const progress = useProgressStore();

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm }]}
      >
        <CultureHeader
          streakDays={progress.streakDays}
          coins={progress.coins}
          hasUnreadNotifications={hasUnreadNotifications}
          onPressAvatar={() => router.push('/character-select' as never)}
          onPressNotifications={() => router.push('/notifications' as never)}
        />

        <View style={styles.horizontalPad}>
          <CultureHero onPress={() => router.push('/collection' as never)} />
        </View>

        <CultureCategoriesGrid
          categories={cultureCategories}
          onPressCategory={handlePressCategory}
          onPressSeeAll={() => router.push('/collection' as never)}
        />

        <View style={[styles.horizontalPad, styles.row]}>
          <TodayDiscoveryCard
            discovery={cultureTodayDiscovery}
            onPress={() => useProgressStore.getState().discoverCulture()}
          />
          <EnterBozUyCard onPress={() => useProgressStore.getState().visitBozUy()} />
        </View>

        <View style={styles.horizontalPad}>
          <CultureProgressCard progress={cultureProgress} />
        </View>

        <View style={[styles.horizontalPad, styles.row]}>
          <View style={styles.quizCol}>
            <QuizTeaserCard onPress={() => console.log('navigate: culture quiz')} />
          </View>
          <View style={styles.materialsCol}>
            <NewMaterialsRow
              materials={cultureNewMaterials}
              onPressMaterial={(material) => console.log('navigate: material detail', material.id)}
              onPressSeeAll={() => console.log('navigate: all materials')}
            />
          </View>
        </View>
      </ScrollView>

      <View style={{ paddingBottom: insets.bottom }}>
        <BottomTabBar
          activeTab="culture"
          onPressTab={(tab) => {
            if (tab === 'home') router.push('/home');
            if (tab === 'games') router.push('/games' as never);
            if (tab === 'explore') router.push('/explore' as never);
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
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quizCol: {
    flex: 0.4,
  },
  materialsCol: {
    flex: 0.6,
  },
});
