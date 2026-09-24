import { LinearGradient } from 'expo-linear-gradient';
import { Play } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import { GameArt } from '@/features/games/components/GameArt';
import { gameArt } from '@/features/games/gamesCatalog';
import { gameTitleKey, type GameListItem } from '@/features/games/types';
import type { AgeExperience } from '@/services/ageExperience/types';
import { colors, spacing, typography } from '@/theme';

import { HOME_RADIUS, HomeSectionHeader } from './homeKit';

const MAX_GAMES = 5;
const CARD_WIDTH: Record<AgeExperience, number> = { child: 210, preteen: 176, teen: 168, adult: 176 };

/**
 * Home's Play teaser - not the Games tab: at most five games (playable
 * ones first) with the same art the Games tab uses, a small play mark, and
 * "See all". No pagination dots.
 */
export function GamesCarousel({ games, experience, onPressGame, onPressSeeAll }: { games: GameListItem[]; experience: AgeExperience; onPressGame: (game: GameListItem) => void; onPressSeeAll: () => void }) {
  const { t } = useTranslation();
  const teaser = [...games].sort((a, b) => Number(!!b.route) - Number(!!a.route)).slice(0, MAX_GAMES);
  const width = CARD_WIDTH[experience];

  return (
    <View style={styles.section}>
      <HomeSectionHeader title={t('home.sections.play')} actionLabel={t('common.seeAll')} onPressAction={onPressSeeAll} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {teaser.map((game) => {
          const title = t(gameTitleKey(game.id));
          const playable = !!game.route;
          return (
            <AnimatedPressable
              key={game.id}
              style={[styles.card, { width }, !playable && styles.locked]}
              onPress={playable ? () => onPressGame(game) : undefined}
              disabled={!playable}
              pressScale={0.97}
              haptic={playable ? 'light' : false}
              accessibilityRole="button"
              accessibilityState={{ disabled: !playable }}
              accessibilityLabel={playable ? `${title}, ${t('games.play')}` : `${title}, ${t('games.comingSoonBadge')}`}
            >
              <GameArt source={gameArt(game, 'card')} title={title} style={StyleSheet.absoluteFill} ornamentSize={64} />
              <LinearGradient colors={['rgba(19,32,24,0)', 'rgba(19,32,24,0.85)']} locations={[0.5, 1]} style={StyleSheet.absoluteFill} />
              {playable ? (
                <View style={styles.playMark}>
                  <Play size={15} color={colors.textPrimary} fill={colors.textPrimary} strokeWidth={0} />
                </View>
              ) : null}
              <Text style={styles.title} numberOfLines={2}>
                {title}
              </Text>
            </AnimatedPressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  row: { paddingHorizontal: spacing.md, gap: spacing.sm },
  card: { aspectRatio: 0.8, borderRadius: HOME_RADIUS.standard, overflow: 'hidden', justifyContent: 'flex-end', padding: spacing.sm, backgroundColor: colors.surfaceFeature, flexShrink: 0 },
  locked: { opacity: 0.7 },
  playMark: { position: 'absolute', top: spacing.sm, right: spacing.sm, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentGold },
  title: { ...typography.bodyBold, fontSize: 17, lineHeight: 22, color: colors.textOnDark },
});
