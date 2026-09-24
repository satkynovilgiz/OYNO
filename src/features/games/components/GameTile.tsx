import { LinearGradient } from 'expo-linear-gradient';
import { Lock, Trophy } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import type { AgeExperience } from '@/services/ageExperience/types';
import type { GameStat } from '@/store/useProgressStore';
import { colors, fontFamily, radii, spacing, typography } from '@/theme';

import { gameArt, isPlayable } from '../gamesCatalog';
import { gameTitleKey, type GameListItem } from '../types';

import { GameArt } from './GameArt';

/**
 * B. Standard game card - art-led portrait tile: the artwork is the card,
 * title on a restrained bottom gradient, at most one line of real meta.
 * The whole tile is the one tappable area (no inner buttons). Games that
 * aren't playable yet say so quietly and aren't tappable.
 */
export function GameTile({
  game,
  stat,
  experience,
  width,
  onPress,
}: {
  game: GameListItem;
  stat: GameStat;
  experience: AgeExperience;
  width: number | `${number}%`;
  onPress: (game: GameListItem) => void;
}) {
  const { t } = useTranslation();
  const title = t(gameTitleKey(game.id));
  const playable = isPlayable(game);
  const isChild = experience === 'child';
  const isAdult = experience === 'adult';
  // Real numbers only: preteens get the achievement-ish cue (wins),
  // teens a quiet play count, adults and children no counters at all.
  const meta = !playable
    ? t('games.comingSoonBadge')
    : experience === 'preteen' && stat.won > 0
      ? t('games.tile.wins', { count: stat.won })
      : experience === 'teen' && stat.played > 0
        ? t('games.playedCount', { count: stat.played })
        : isAdult
          ? t(`games.categories.${game.category}`)
          : null;

  return (
    <AnimatedPressable
      style={[styles.tile, { width, aspectRatio: isChild ? 1.25 : 0.78 }, !playable && styles.locked]}
      onPress={playable ? () => onPress(game) : undefined}
      disabled={!playable}
      pressScale={0.97}
      haptic={playable ? 'light' : false}
      hoverEffect
      accessibilityRole="button"
      accessibilityState={{ disabled: !playable }}
      accessibilityLabel={playable ? `${title}${meta ? `, ${meta}` : ''}` : `${title}, ${t('games.comingSoonBadge')}`}
    >
      <GameArt source={gameArt(game, isChild ? 'large' : 'card')} title={title} style={StyleSheet.absoluteFill} ornamentSize={isChild ? 72 : 52} />
      <LinearGradient colors={['rgba(19,32,24,0)', 'rgba(19,32,24,0.88)']} locations={[0.45, 1]} style={StyleSheet.absoluteFill} />
      <View style={styles.text}>
        <Text style={[styles.title, isChild && styles.titleChild, isAdult && styles.titleAdult]} numberOfLines={2}>
          {title}
        </Text>
        {meta ? (
          <View style={styles.metaRow}>
            {!playable ? <Lock size={11} color={colors.accentGold} strokeWidth={2.5} /> : experience === 'preteen' && stat.won > 0 ? <Trophy size={11} color={colors.accentGold} strokeWidth={2.5} /> : null}
            <Text style={styles.meta} numberOfLines={1}>
              {meta}
            </Text>
          </View>
        ) : null}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  tile: { borderRadius: radii.xl, overflow: 'hidden', justifyContent: 'flex-end', backgroundColor: colors.surfaceFeature, flexShrink: 0 },
  locked: { opacity: 0.72 },
  text: { padding: spacing.sm, gap: 2 },
  title: { ...typography.bodyBold, fontSize: 16, lineHeight: 20, color: colors.textOnDark },
  titleChild: { fontSize: 22, lineHeight: 27 },
  titleAdult: { fontFamily: fontFamily.wordmark },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meta: { ...typography.small, fontWeight: '600', color: 'rgba(251,243,227,0.82)', flexShrink: 1 },
});
