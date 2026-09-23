import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable, FadeSlideIn } from '@/components/ui';
import { resolveByCardScale } from '@/services/ageExperience/scale';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { colors, radii, shadows, spacing, typography } from '@/theme';

import { questBackgroundFor } from '../data';
import type { ExploreQuest } from '../types';

type CurrentQuestCardProps = {
  quest: ExploreQuest;
  onPress?: () => void;
};

const ASPECT_RATIO_BY_CARD_SCALE = { large: 1.7, medium: 2.4, compact: 2.6, dense: 2.9 };
const TITLE_FONT_SIZE_BY_CARD_SCALE = { large: 24, medium: 20, compact: 18, dense: 16 };

/** Background art (Бөрү + shyrdak, forest backdrop) sliced from the design
 * reference, right-aligned; a dark-to-transparent gradient over the left
 * keeps the text legible per the reference. */
export function CurrentQuestCard({ quest, onPress }: CurrentQuestCardProps) {
  const { t } = useTranslation();
  const { config } = useAgeExperience();

  return (
    // Shadow lives on this wrapper, not the clipped/overflow:hidden card
    // itself - a view drops its own shadow on iOS once it also clips
    // content via overflow (same fix as HeroBanner.tsx/KyrgyzstanMap.tsx).
    <FadeSlideIn style={shadows.card}>
      <AnimatedPressable
        style={[styles.card, { aspectRatio: resolveByCardScale(config.cardScale, ASPECT_RATIO_BY_CARD_SCALE) }]}
        onPress={onPress}
        hoverEffect
        accessibilityRole="button"
        accessibilityLabel={quest.title}
      >
      <View style={styles.background} />
      {/* Full-bleed, cover-cropped from the right edge so Börü and the
          shyrdak (right third of the art) stay in frame at every card
          aspect ratio, while the darker left side sits under the text. */}
      <Image source={questBackgroundFor(quest.id)} style={styles.artwork} contentFit="cover" contentPosition="right" />
      <LinearGradient
        colors={['rgba(20,28,12,0.9)', 'rgba(20,28,12,0.55)', 'rgba(20,28,12,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.content}>
        <View style={styles.labelRow}>
          <OymoOrnament size={11} color={colors.accentGold} strokeWidth={1.5} />
          <Text style={styles.label}>{t('explore.quest.label')}</Text>
        </View>
        <Text style={[styles.title, { fontSize: resolveByCardScale(config.cardScale, TITLE_FONT_SIZE_BY_CARD_SCALE) }]}>
          {quest.title}
        </Text>
        <Text style={styles.subtitle}>{quest.subtitle}</Text>
        <Text style={styles.progress}>
          {quest.foundCount} / {quest.totalCount} {t('explore.quest.foundSuffix')}
        </Text>

        <View style={styles.cta}>
          <Text style={styles.ctaLabel}>{quest.ctaLabel}</Text>
          <ChevronRight size={16} color={colors.textOnPrimary} strokeWidth={2.5} />
        </View>
      </View>
      </AnimatedPressable>
    </FadeSlideIn>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    overflow: 'hidden',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(232,185,61,0.4)',
  },
  background: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.tiles.culture,
  },
  artwork: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 2,
    maxWidth: '72%',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  label: {
    ...typography.overline,
    color: colors.accentGold,
  },
  title: {
    ...typography.h1,
    color: colors.textOnDark,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textOnDark,
    opacity: 0.9,
  },
  progress: {
    ...typography.bodyBold,
    color: colors.accentGold,
    marginTop: 2,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xxs,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    marginTop: spacing.xs,
  },
  ctaLabel: {
    ...typography.caption,
    color: colors.textOnPrimary,
    fontWeight: '700',
  },
});
