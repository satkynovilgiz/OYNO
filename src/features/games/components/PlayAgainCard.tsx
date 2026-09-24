import { Play } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import type { GameStat } from '@/store/useProgressStore';
import { colors, radii, spacing, typography } from '@/theme';

import { gameArt } from '../gamesCatalog';
import { gameTitleKey, type GameListItem } from '../types';

import { GameArt } from './GameArt';

/**
 * C. Compact "play again" card - only for a game the user has REALLY
 * played (real play count). OYNO doesn't record when a game was last
 * played, so it never claims "continue" or "last played".
 */
export function PlayAgainCard({ game, stat, onPress }: { game: GameListItem; stat: GameStat; onPress: (game: GameListItem) => void }) {
  const { t } = useTranslation();
  const title = t(gameTitleKey(game.id));
  const stats = stat.won > 0 ? t('games.playAgain.statsWithWins', { played: stat.played, won: stat.won }) : t('games.playAgain.stats', { played: stat.played });
  return (
    <AnimatedPressable
      style={styles.card}
      onPress={() => onPress(game)}
      pressScale={0.98}
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={`${t('games.playAgain.label')}: ${title}, ${stats}`}
    >
      <GameArt source={gameArt(game, 'card')} title={title} style={styles.thumb} ornamentSize={34} />
      <View style={styles.text}>
        <Text style={styles.eyebrow}>{t('games.playAgain.label')}</Text>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.stats} numberOfLines={1}>
          {stats}
        </Text>
      </View>
      <View style={styles.play}>
        <Play size={18} color={colors.textPrimary} fill={colors.textPrimary} strokeWidth={0} />
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.xs, paddingRight: spacing.sm, borderRadius: radii.xl, backgroundColor: 'rgba(19,32,24,0.78)', borderWidth: 1, borderColor: 'rgba(232,185,61,0.35)' },
  thumb: { width: 56, height: 56, borderRadius: radii.lg },
  text: { flex: 1, gap: 1 },
  eyebrow: { ...typography.overline, color: colors.accentGold },
  title: { ...typography.bodyBold, color: colors.textOnDark },
  stats: { ...typography.small, fontWeight: '500', color: 'rgba(251,243,227,0.75)' },
  play: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentGold },
});
