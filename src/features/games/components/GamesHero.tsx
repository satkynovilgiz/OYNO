import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CharacterAvatar } from '@/components/character';
import type { CharacterId } from '@/components/character/characterAssets';
import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import type { AgeExperience } from '@/services/ageExperience/types';
import type { useHeroParallax } from '@/services/motion/useHeroParallax';
import { colors, fontFamily, radii, spacing, typography } from '@/theme';

import { GAMES_HERO_ART } from '../gamesCatalog';

/**
 * "Оюн дүйнөсү" - the Games tab's cinematic hero: full-bleed traditional
 * game artwork (drifts slower than the scroll; still under Reduce Motion),
 * a restrained dark gradient, the title, and - only when real play history
 * exists - a compact "play again" card anchored at the bottom.
 */
export function GamesHero({
  experience,
  coins,
  gems,
  characterId,
  parallaxStyle,
  children,
}: {
  experience: AgeExperience;
  coins: number;
  gems: number;
  characterId: CharacterId | null;
  parallaxStyle?: ReturnType<typeof useHeroParallax>['heroStyle'];
  /** The optional play-again card. */
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isChild = experience === 'child';
  const isAdult = experience === 'adult';

  return (
    <View style={[styles.hero, { paddingTop: insets.top + spacing.sm, minHeight: (isChild ? 300 : 340) + insets.top }]}>
      <Animated.View style={[StyleSheet.absoluteFill, parallaxStyle]}>
        <Image source={GAMES_HERO_ART} style={styles.image} resizeMode="cover" accessibilityIgnoresInvertColors />
      </Animated.View>
      <LinearGradient colors={['rgba(19,32,24,0.55)', 'rgba(19,32,24,0.05)', 'rgba(19,32,24,0.94)']} locations={[0, 0.38, 1]} style={StyleSheet.absoluteFill} />

      <View style={styles.topRow}>
        <View style={styles.brand}>
          <OymoOrnament size={16} color={colors.accentGold} strokeWidth={1.6} />
          <Text style={styles.brandText}>OYNO</Text>
        </View>
        <View style={styles.wallet} accessible accessibilityLabel={t('games.hero.wallet', { coins, gems })}>
          <View style={styles.pill}>
            <View style={[styles.dot, { backgroundColor: colors.accentGold }]} />
            <Text style={styles.pillText}>{coins.toLocaleString('ru-RU')}</Text>
          </View>
          <View style={styles.pill}>
            <View style={[styles.dot, { backgroundColor: colors.accentSilver }]} />
            <Text style={styles.pillText}>{gems.toLocaleString('ru-RU')}</Text>
          </View>
        </View>
      </View>

      <View style={styles.bottom}>
        <View style={styles.titleRow}>
          <View style={styles.titleBlock}>
            <Text style={[styles.title, isChild && styles.titleChild]} accessibilityRole="header">
              {t('games.hero.title')}
            </Text>
            <Text style={styles.subtitle} numberOfLines={isAdult ? 3 : 2}>
              {isChild ? t('games.hero.childSubtitle') : t('games.hero.subtitle')}
            </Text>
          </View>
          {isChild && characterId ? (
            <View style={styles.guide} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <CharacterAvatar characterId={characterId} emotion="happy" size={72} />
            </View>
          ) : null}
        </View>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingBottom: spacing.lg, overflow: 'hidden', borderBottomLeftRadius: radii.xxl, borderBottomRightRadius: radii.xxl, backgroundColor: colors.surfaceFeature },
  image: { width: '100%', height: '100%' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandText: { fontFamily: fontFamily.wordmark, fontSize: 15, fontWeight: '700', letterSpacing: 3, color: colors.textOnDark },
  wallet: { flexDirection: 'row', gap: spacing.xs },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radii.pill, backgroundColor: 'rgba(19,32,24,0.6)' },
  dot: { width: 9, height: 9, borderRadius: 5 },
  pillText: { ...typography.caption, fontWeight: '700', color: colors.textOnDark },
  bottom: { gap: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  titleBlock: { flex: 1, gap: spacing.xxs },
  title: { fontFamily: fontFamily.wordmark, fontSize: 36, lineHeight: 42, fontWeight: '700', color: colors.textOnDark },
  titleChild: { fontSize: 31, lineHeight: 37 },
  subtitle: { ...typography.body, color: 'rgba(251,243,227,0.86)' },
  guide: { marginBottom: -spacing.xs },
});
