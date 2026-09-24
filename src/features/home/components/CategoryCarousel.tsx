import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import type { AgeExperience } from '@/services/ageExperience/types';
import { colors, fontFamily, spacing, typography } from '@/theme';

import type { CultureTile } from '../types';

import { HOME_RADIUS, HomeSectionHeader } from './homeKit';

/** Card width per age: children get fewer, bigger cards on screen. */
const CARD_WIDTH: Record<AgeExperience, number> = { child: 260, preteen: 220, teen: 196, adult: 232 };

/**
 * "Explore OYNO" - the existing four category destinations as a horizontal
 * media carousel: the artwork is the card, a restrained gradient, the title
 * (two lines allowed, so Kyrgyz titles never break mid-word or truncate
 * early), a short subtitle and a small chevron. The whole card is the tap
 * target - no big circular buttons over the art.
 */
export function CategoryCarousel({ tiles, experience, onPressTile }: { tiles: CultureTile[]; experience: AgeExperience; onPressTile: (tile: CultureTile) => void }) {
  const { t } = useTranslation();
  const width = CARD_WIDTH[experience];
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
                <ChevronRight size={16} color={colors.accentGold} strokeWidth={2.5} />
              </View>
              {experience !== 'child' ? (
                <Text style={styles.subtitle} numberOfLines={1}>
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
  card: { aspectRatio: 1.3, borderRadius: HOME_RADIUS.standard, overflow: 'hidden', justifyContent: 'flex-end', backgroundColor: colors.surfaceFeature, flexShrink: 0 },
  image: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  text: { padding: spacing.sm, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  title: { ...typography.h2, fontSize: 18, lineHeight: 22, color: colors.textOnDark, flexShrink: 1 },
  titleEditorial: { fontFamily: fontFamily.wordmark },
  subtitle: { ...typography.small, fontWeight: '500', color: 'rgba(251,243,227,0.82)' },
});
