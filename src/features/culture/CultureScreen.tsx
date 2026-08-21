import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabBar } from '@/components/navigation/BottomTabBar';
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

// Local-only mock (no streak/wallet system exists yet); same convention as
// the rest of this screen's mock data.
const mockStreakDays = 12;
const mockCoins = 450;
const mockHasUnreadNotifications = true;

function handlePressCategory(category: CultureCategory) {
  if (category.id === 'games') {
    router.push('/games' as never);
    return;
  }
  console.log('navigate: culture category', category.id);
}

export function CultureScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm }]}
      >
        <CultureHeader
          streakDays={mockStreakDays}
          coins={mockCoins}
          hasUnreadNotifications={mockHasUnreadNotifications}
          onPressAvatar={() => router.push('/character-select' as never)}
          onPressSearch={() => console.log('navigate: culture search')}
          onPressNotifications={() => console.log('navigate: notifications')}
        />

        <View style={styles.horizontalPad}>
          <CultureHero onPress={() => console.log('navigate: culture explore')} />
        </View>

        <CultureCategoriesGrid
          categories={cultureCategories}
          onPressCategory={handlePressCategory}
          onPressSeeAll={() => console.log('navigate: all culture categories')}
        />

        <View style={[styles.horizontalPad, styles.row]}>
          <TodayDiscoveryCard
            discovery={cultureTodayDiscovery}
            onPress={() => console.log('navigate: today discovery detail')}
          />
          <EnterBozUyCard onPress={() => console.log('navigate: interactive boz uy')} />
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
            if (tab === 'home') router.push('/');
            if (tab === 'games') router.push('/games' as never);
            if (tab === 'explore') router.push('/explore' as never);
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
