import { router } from 'expo-router';
import { Gamepad2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { EmptyState } from '@/components/ui';
import { useTrackScreenView } from '@/services/analytics/useTrackScreenView';
import { useProgressStore } from '@/store/useProgressStore';
import { colors, spacing, typography } from '@/theme';

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

  // 3D games get their own showcase row instead of a per-card badge
  // (Section "Clearly distinguish 3D games... without a cheap '3D' badge
  // everywhere") - still driven by the same search/category filter as the
  // grid below, just presented separately, so search/filtering keeps
  // working exactly as before across every game.
  const featured3D = useMemo(() => filteredGames.filter((game) => game.is3D), [filteredGames]);
  const otherGames = useMemo(() => filteredGames.filter((game) => !game.is3D), [filteredGames]);

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

        {featured3D.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('games.featured3D.title')}</Text>
              <Text style={styles.sectionSubtitle}>{t('games.featured3D.subtitle')}</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.featuredRow}
            >
              {featured3D.map((game, index) => (
                <GameCard key={game.id} game={game} onPress={handlePressGame} index={index} size="featured" />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {featured3D.length > 0 && (otherGames.length > 0 || (category === 'all' && !query)) ? (
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <OymoOrnament size={12} color={colors.border} strokeWidth={1.5} />
            <View style={styles.dividerLine} />
          </View>
        ) : null}

        {filteredGames.length === 0 ? (
          <View style={styles.horizontalPad}>
            <EmptyState
              icon={Gamepad2}
              title={t('games.searchEmpty.title')}
              description={t('games.searchEmpty.description')}
              actionLabel={t('games.searchEmpty.action')}
              onPressAction={() => {
                setQuery('');
                setCategory('all');
              }}
            />
          </View>
        ) : (
          <View style={styles.grid}>
            {otherGames.map((game, index) => (
              <GameCard key={game.id} game={game} onPress={handlePressGame} index={index} />
            ))}
            {category === 'all' && !query ? <ComingSoonCard /> : null}
          </View>
        )}

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
  section: {
    gap: spacing.sm,
  },
  sectionHeader: {
    paddingHorizontal: spacing.md,
    gap: 1,
  },
  sectionTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  sectionSubtitle: {
    ...typography.small,
    color: colors.textSecondary,
  },
  featuredRow: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xl,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
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
