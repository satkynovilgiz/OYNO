import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import { useTrackScreenView } from '@/services/analytics/useTrackScreenView';
import { useProgressStore } from '@/store/useProgressStore';
import { colors, spacing } from '@/theme';

import {
  CategoryFilters,
  ComingSoonCard,
  GameCard,
  GamesHeader,
  InviteFriendsBanner,
  SearchBar,
} from './components';
import { mockGamesList } from './mockData';
import type { GameListItem } from './types';

export function GamesScreen() {
  useTrackScreenView('games');
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const coins = useProgressStore((state) => state.coins);
  const gems = useProgressStore((state) => state.gems);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<GameListItem['category'] | 'all'>('all');

  const filteredGames = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return mockGamesList.filter((game) => {
      const matchesCategory = category === 'all' || game.category === category;
      const matchesQuery = !normalizedQuery || game.name.toLowerCase().includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [query, category]);

  const handlePressGame = (game: GameListItem) => {
    if (game.route) {
      router.push(game.route as never);
    }
  };

  const handlePressInvite = () => {
    // Rejects on web when the browser has no Web Share API, and on native
    // when the user backs out of the sheet without picking an app -
    // neither is a real error worth surfacing.
    Share.share({ message: t('games.invite.shareMessage') }).catch(() => {});
  };

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm }]}
      >
        <GamesHeader coins={coins} tokens={gems} />

        <SearchBar value={query} onChangeText={setQuery} />

        <CategoryFilters active={category} onSelect={setCategory} />

        <View style={styles.grid}>
          {filteredGames.map((game) => (
            <GameCard key={game.id} game={game} onPress={handlePressGame} />
          ))}
          {category === 'all' && !query ? <ComingSoonCard /> : null}
        </View>

        <View style={styles.horizontalPad}>
          <InviteFriendsBanner onPressInvite={handlePressInvite} />
        </View>
      </ScrollView>

      <View style={{ paddingBottom: insets.bottom }}>
        <BottomTabBar
          activeTab="games"
          onPressTab={(tab) => {
            if (tab === 'home') router.push('/home');
            if (tab === 'explore') router.push('/explore' as never);
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  horizontalPad: {
    paddingHorizontal: spacing.md,
  },
});
