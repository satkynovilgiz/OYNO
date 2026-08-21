import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight } from 'lucide-react-native';
import { Image, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import { colors, radii, shadows, spacing, typography } from '@/theme';
import questBackground from '@assets/img/OYNO_design/explore/quest_boru_shyrdak.png';

import type { ExploreQuest } from '../types';

type CurrentQuestCardProps = {
  quest: ExploreQuest;
  onPress?: () => void;
};

/** Background art (Бөрү + shyrdak, forest backdrop) sliced from the design
 * reference, right-aligned; a dark-to-transparent gradient over the left
 * keeps the text legible per the reference. */
export function CurrentQuestCard({ quest, onPress }: CurrentQuestCardProps) {
  return (
    <AnimatedPressable style={styles.card} onPress={onPress} accessibilityRole="button" accessibilityLabel={quest.title}>
      <View style={styles.background} />
      <Image source={questBackground} style={styles.artwork} resizeMode="cover" />
      <LinearGradient
        colors={['rgba(20,28,12,0.9)', 'rgba(20,28,12,0.55)', 'rgba(20,28,12,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.content}>
        <Text style={styles.label}>Азыркы квест</Text>
        <Text style={styles.title}>{quest.title}</Text>
        <Text style={styles.subtitle}>{quest.subtitle}</Text>
        <Text style={styles.progress}>
          {quest.foundCount} / {quest.totalCount} табылды
        </Text>

        <View style={styles.cta}>
          <Text style={styles.ctaLabel}>{quest.ctaLabel}</Text>
          <ChevronRight size={16} color={colors.textOnPrimary} strokeWidth={2.5} />
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    aspectRatio: 2.4,
    borderRadius: radii.xl,
    overflow: 'hidden',
    justifyContent: 'center',
    ...shadows.card,
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.tiles.culture,
  },
  artwork: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '62%',
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 2,
    maxWidth: '72%',
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
