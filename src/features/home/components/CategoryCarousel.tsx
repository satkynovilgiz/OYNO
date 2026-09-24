import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import type { AgeExperience } from '@/services/ageExperience/types';
import { colors, fontFamily, spacing, typography } from '@/theme';

import type { CultureTile } from '../types';

import { HOME_RADIUS, HomeSectionHeader } from './homeKit';

/** Card width as a share of the phone width: the first card is
 * comfortably readable and the next one peeks in naturally. */
const WIDTH_SHARE: Record<AgeExperience, number> = { child: 0.84, preteen: 0.78, teen: 0.76, adult: 0.8 };

/**
 * "Explore OYNO" - the existing four category destinations as a horizontal
 * media carousel: the artwork is the card, a restrained gradient, the title
 * (two lines allowed, so Kyrgyz titles never break mid-word or truncate
 * early), a short subtitle and a small chevron. The whole card is the tap
 * target - no big circular buttons over the art.
 */
export function CategoryCarousel({ tiles, experience, onPressTile }: { tiles: CultureTile[]; experience: AgeExperience; onPressTile: (tile: CultureTile) => void }) {
  const { t } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();
  const width = Math.min(Math.round(screenWidth * WIDTH_SHARE[experience]), 380);
  const isAdult = experience === 'adult';

  return (
    <View style={styles.section}>
      <HomeSectionHeader title={t('home.sections.explore')} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} decelerationRate="fast">
        {tiles.map((tile) => (
          <AnimatedPressable
            key={tile.id}
            style={[styles.card, { width }]}
            onPress={() => onPressTile(tile)}
            pressScale={0.97}
            haptic="light"
            accessibilityRole="button"
            accessibilityLabel={`${tile.title}. ${tile.subtitle}`}
          >
            <Image source={tile.imageSource} style={styles.image} resizeMode="cover" accessibilityIgnoresInvertColors />
            <LinearGradient colors={['rgba(19,32,24,0)', 'rgba(19,32,24,0.86)']} locations={[0.35, 1]} style={StyleSheet.absoluteFill} />
            <View style={styles.text}>
              <View style={styles.titleRow}>
                <Text style={[styles.title, isAdult && styles.titleEditorial]} numberOfLines={2}>
                  {tile.title}
                </Text>
                <ChevronRight size={20} color={colors.accentGold} strokeWidth={2.5} />
              </View>
              {experience !== 'child' ? (
                <Text style={styles.subtitle} numberOfLines={2}>
                  {tile.subtitle}
                </Text>
              ) : null}
            </View>
          </AnimatedPressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  row: { paddingHorizontal: spacing.md, gap: spacing.sm },
  card: { aspectRatio: 1.08, borderRadius: HOME_RADIUS.hero, overflow: 'hidden', justifyContent: 'flex-end', backgroundColor: colors.surfaceFeature, flexShrink: 0 },
  image: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  text: { padding: spacing.lg, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { ...typography.display, fontSize: 26, lineHeight: 31, color: colors.textOnDark, flexShrink: 1 },
  titleEditorial: { fontFamily: fontFamily.wordmark },
  subtitle: { ...typography.body, fontSize: 15, color: 'rgba(251,243,227,0.86)' },
});
