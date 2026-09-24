import { LinearGradient } from 'expo-linear-gradient';
import { Play } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable } from '@/components/ui';
import type { AgeExperience } from '@/services/ageExperience/types';
import { colors, fontFamily, radii, spacing, typography } from '@/theme';

import { firstSentence, gameArt, gameDescriptionKey } from '../gamesCatalog';
import { gameTitleKey, type GameListItem } from '../types';

import { GameArt } from './GameArt';

/**
 * A. Featured card - one large cinematic card: art, title, category, one
 * short real description, and a single strong Play action. The whole card
 * opens the game (the Play pill is part of it, not a second button).
 */
export function FeaturedGameCard({ game, experience, onPress }: { game: GameListItem; experience: AgeExperience; onPress: (game: GameListItem) => void }) {
  const { t } = useTranslation();
  const title = t(gameTitleKey(game.id));
  const descriptionKey = gameDescriptionKey(game.id);
  const isChild = experience === 'child';
  const isAdult = experience === 'adult';
  const description = descriptionKey && !isChild ? firstSentence(t(descriptionKey)) : null;

  return (
    <AnimatedPressable
      style={[styles.card, { aspectRatio: isChild ? 0.95 : isAdult ? 1.35 : 1.15 }]}
      onPress={() => onPress(game)}
      pressScale={0.985}
      haptic="medium"
      accessibilityRole="button"
      accessibilityLabel={`${t('games.featured.label')}: ${title}. ${t('games.play')}`}
      accessibilityHint={description ?? undefined}
    >
      <GameArt source={gameArt(game, 'large')} title={title} style={StyleSheet.absoluteFill} ornamentSize={120} />
      <LinearGradient colors={['rgba(19,32,24,0.1)', 'rgba(19,32,24,0)', 'rgba(19,32,24,0.92)']} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} />
      <View style={styles.badge}>
        <OymoOrnament size={11} color={colors.accentGold} strokeWidth={1.75} />
        <Text style={styles.badgeText}>{t('games.featured.label')}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.category}>{t(`games.categories.${game.category}`)}</Text>
        <Text style={[styles.title, isChild && styles.titleChild, isAdult && styles.titleAdult]} numberOfLines={2}>
          {title}
        </Text>
        {description ? (
          <Text style={styles.description} numberOfLines={isAdult ? 3 : 2}>
            {description}
          </Text>
        ) : null}
        <View style={[styles.play, isChild && styles.playChild]}>
          <Play size={isChild ? 22 : 16} color={colors.textPrimary} fill={colors.textPrimary} strokeWidth={0} />
          <Text style={[styles.playText, isChild && styles.playTextChild]}>{t('games.play')}</Text>
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', borderRadius: radii.xxl, overflow: 'hidden', justifyContent: 'flex-end', backgroundColor: colors.surfaceFeature },
  badge: { position: 'absolute', top: spacing.md, left: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: radii.pill, backgroundColor: 'rgba(19,32,24,0.7)' },
  badgeText: { ...typography.overline, color: colors.accentGold },
  body: { padding: spacing.lg, gap: spacing.xs },
  category: { ...typography.overline, color: colors.accentGold },
  title: { fontFamily: fontFamily.wordmark, fontSize: 30, lineHeight: 35, fontWeight: '700', color: colors.textOnDark },
  titleChild: { fontSize: 34, lineHeight: 40 },
  titleAdult: { fontSize: 28, lineHeight: 33 },
  description: { ...typography.body, color: 'rgba(251,243,227,0.86)' },
  play: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: spacing.xs, marginTop: spacing.xs, minHeight: 48, paddingHorizontal: spacing.lg, borderRadius: radii.pill, backgroundColor: colors.accentGold },
  playChild: { alignSelf: 'stretch', justifyContent: 'center', minHeight: 64 },
  playText: { ...typography.bodyBold, color: colors.textPrimary },
  playTextChild: { fontSize: 20 },
});
