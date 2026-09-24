import { router } from 'expo-router';
import { Gamepad2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Share, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import { EmptyState, FadeSlideIn } from '@/components/ui';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { useTrackScreenView } from '@/services/analytics/useTrackScreenView';
import { dayNumber, localDateKey } from '@/services/daily/dailyDiscovery';
import { useHeroParallax } from '@/services/motion/useHeroParallax';
import { useAppStore } from '@/store/useAppStore';
import { useProgressStore } from '@/store/useProgressStore';
import { colors, fontFamily, spacing, typography } from '@/theme';

import { FeaturedGameCard, GamesHero, GameTile, InviteFriendsBanner, PlayAgainCard, SearchBar } from './components';
import { gameSections, gameStatsFor, isPlayable, pickFeaturedGame, pickPlayAgain } from './gamesCatalog';
import { mockGamesList } from './mockData';
import { gameTitleKey, type GameListItem } from './types';

/** Standard tile width in a category carousel, per age mode. */
const TILE_WIDTH = { child: 0, preteen: 158, teen: 148, adult: 168 } as const;

/**
 * Games tab - "Оюн дүйнөсү":
 *   1. cinematic hero (+ a compact "play again" card only when the user
 *      has really played a game)
 *   2. one large Featured game (daily rotation among playable games with
 *      large art - never the play-again game)
 *   3. search
 *   4. category carousels built from each game's own `category`
 * One catalog (mockGamesList), same routes and ids for every age mode;
 * only presentation adapts.
 */
export function GamesScreen() {
  useTrackScreenView('games');
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const coins = useProgressStore((state) => state.coins);
  const gems = useProgressStore((state) => state.gems);
  const gameStats = useProgressStore((state) => state.gameStats);
  const characterId = useAppStore((state) => state.characterId);
  const { scrollHandler, heroStyle } = useHeroParallax();
  const [query, setQuery] = useState('');

  const isChild = experience === 'child';
  const playAgain = useMemo(() => pickPlayAgain(mockGamesList, gameStats), [gameStats]);
  const featured = useMemo(() => pickFeaturedGame(mockGamesList, dayNumber(localDateKey()), playAgain?.game.id), [playAgain]);
  const sections = useMemo(() => gameSections(mockGamesList), []);

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return null;
    return mockGamesList.filter((game) => t(gameTitleKey(game.id)).toLowerCase().includes(normalized));
  }, [query, t]);

  const openGame = (game: GameListItem) => {
    if (game.route) router.push(game.route as never);
  };

  return (
    <View style={styles.root}>
      <Animated.ScrollView onScroll={scrollHandler} scrollEventThrottle={16} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <GamesHero experience={experience} coins={coins} gems={gems} characterId={characterId} parallaxStyle={heroStyle}>
          {playAgain ? <PlayAgainCard game={playAgain.game} stat={playAgain.stat} onPress={openGame} /> : null}
        </GamesHero>

        {featured ? (
          <FadeSlideIn index={0} style={styles.pad}>
            <FeaturedGameCard game={featured} experience={experience} onPress={openGame} />
          </FadeSlideIn>
        ) : null}

        {!isChild ? (
          <FadeSlideIn index={1}>
            <SearchBar value={query} onChangeText={setQuery} />
          </FadeSlideIn>
        ) : null}

        {results ? (
          results.length === 0 ? (
            <View style={styles.pad}>
              <EmptyState
                icon={Gamepad2}
                title={t('games.searchEmpty.title')}
                description={t('games.searchEmpty.description')}
                actionLabel={t('games.searchEmpty.action')}
                onPressAction={() => setQuery('')}
              />
            </View>
          ) : (
            <View style={[styles.pad, styles.grid]}>
              {results.map((game) => (
                <GameTile key={game.id} game={game} stat={gameStatsFor(game, gameStats)} experience={experience} width="48%" onPress={openGame} />
              ))}
            </View>
          )
        ) : isChild ? (
          // Children: fewer, bigger choices - only games they can play now.
          <FadeSlideIn index={2} style={[styles.pad, styles.section]}>
            <Text style={[styles.sectionTitle, styles.sectionTitleChild]}>{t('games.sections.playNow')}</Text>
            {mockGamesList.filter(isPlayable).map((game) => (
              <GameTile key={game.id} game={game} stat={gameStatsFor(game, gameStats)} experience={experience} width="100%" onPress={openGame} />
            ))}
          </FadeSlideIn>
        ) : (
          sections.map((section, index) => (
            <FadeSlideIn key={section.category} index={index + 2} style={styles.section}>
              <View style={[styles.pad, styles.sectionHeader]}>
                <Text style={[styles.sectionTitle, experience === 'adult' && styles.sectionTitleEditorial]} accessibilityRole="header">
                  {t(`games.categories.${section.category}`)}
                </Text>
                <Text style={styles.sectionCount}>{section.games.length}</Text>
              </View>
              <Animated.ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
                {section.games.map((game) => (
                  <GameTile key={game.id} game={game} stat={gameStatsFor(game, gameStats)} experience={experience} width={TILE_WIDTH[experience]} onPress={openGame} />
                ))}
              </Animated.ScrollView>
            </FadeSlideIn>
          ))
        )}

        <FadeSlideIn index={9} style={styles.pad}>
          <InviteFriendsBanner onPressInvite={() => void Share.share({ message: t('games.invite.shareMessage') }).catch(() => {})} />
        </FadeSlideIn>
      </Animated.ScrollView>

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
  root: { flex: 1, backgroundColor: colors.background },
  content: { gap: spacing.lg, paddingBottom: spacing.xl },
  pad: { paddingHorizontal: spacing.md },
  section: { gap: spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  sectionTitle: { ...typography.h1, color: colors.textPrimary },
  sectionTitleChild: { fontSize: 24 },
  sectionTitleEditorial: { fontFamily: fontFamily.wordmark },
  sectionCount: { ...typography.caption, fontWeight: '700', color: colors.accentTerracotta },
  carousel: { paddingHorizontal: spacing.md, gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.sm },
});
