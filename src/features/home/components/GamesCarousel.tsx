import { Play } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { MediaCard, Rail, SectionHeader, useRailItemWidth } from '@/components/ui';
import { GameArt } from '@/features/games/components/GameArt';
import { gameArt } from '@/features/games/gamesCatalog';
import { gameTitleKey, type GameListItem } from '@/features/games/types';
import type { AgeExperience } from '@/services/ageExperience/types';
import { colors, spacing } from '@/theme';

const MAX_GAMES = 5;
/** ~46% of the content width: two readable tiles side by side, the third
 * peeking. Children get a little more. */
const SHARE: Record<AgeExperience, number> = { child: 0.52, preteen: 0.46, teen: 0.44, adult: 0.45 };

/**
 * Home's Play teaser - not the Games tab: at most five games (playable
 * ones first) with the Games tab's own art, title near the bottom and a
 * small play mark. No big play buttons, no pagination dots.
 */
export function GamesCarousel({ games, experience, onPressGame, onPressSeeAll }: { games: GameListItem[]; experience: AgeExperience; onPressGame: (game: GameListItem) => void; onPressSeeAll: () => void }) {
  const { t } = useTranslation();
  const teaser = [...games].sort((a, b) => Number(!!b.route) - Number(!!a.route)).slice(0, MAX_GAMES);
  const width = useRailItemWidth('compact', SHARE[experience]);

  return (
    <View style={styles.section}>
      <SectionHeader title={t('home.sections.play')} actionLabel={t('common.seeAll')} onPressAction={onPressSeeAll} />
      <Rail itemWidth={width}>
        {teaser.map((game) => {
          const title = t(gameTitleKey(game.id));
          const playable = !!game.route;
          return (
            <MediaCard
              key={game.id}
              variant="compact"
              width={width}
              aspectRatio={0.84}
              artwork={<GameArt source={gameArt(game, 'card')} title={title} style={StyleSheet.absoluteFill} ornamentSize={56} />}
              title={title}
              status={
                playable ? (
                  <View style={styles.play}>
                    <Play size={12} color={colors.accentGold} fill={colors.accentGold} strokeWidth={0} />
                  </View>
                ) : undefined
              }
              style={!playable && styles.locked}
              onPress={playable ? () => onPressGame(game) : undefined}
              accessibilityLabel={playable ? `${title}, ${t('games.play')}` : `${title}, ${t('games.comingSoonBadge')}`}
            />
          );
        })}
      </Rail>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  locked: { opacity: 0.7 },
  play: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.chipOnDark, paddingLeft: 2 },
});
