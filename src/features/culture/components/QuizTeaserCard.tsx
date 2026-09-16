import { ArrowRight, GraduationCap } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable, FadeSlideIn, IconChip } from '@/components/ui';
import { colors, radii, spacing, typography } from '@/theme';

type QuizTeaserCardProps = {
  onPress?: () => void;
};

/** Whole card is the tap target now, not just the small CTA pill (Section
 * "Improve pressed states") - the pill stays as a visual affordance rather
 * than a second, separately-firing pressable. */
export function QuizTeaserCard({ onPress }: QuizTeaserCardProps) {
  const { t } = useTranslation();

  return (
    <FadeSlideIn>
      <AnimatedPressable style={styles.card} onPress={onPress} hoverEffect accessibilityRole="button" accessibilityLabel={t('culture.quiz.cta')}>
        <View style={styles.textCol}>
          <Text style={styles.title}>{t('culture.quiz.title')}</Text>
          <Text style={styles.description}>{t('culture.quiz.description')}</Text>

          <View style={styles.cta}>
            <Text style={styles.ctaLabel}>{t('culture.quiz.cta')}</Text>
            <ArrowRight size={14} color={colors.textOnPrimary} strokeWidth={2.5} />
          </View>
        </View>
        <IconChip icon={GraduationCap} size={56} iconSize={26} color={colors.primary} />
      </AnimatedPressable>
    </FadeSlideIn>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderRadius: radii.xl,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  textCol: {
    flex: 1,
    gap: spacing.xxs,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  description: {
    ...typography.small,
    color: colors.textSecondary,
    lineHeight: 15,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xxs,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    marginTop: spacing.xxs,
  },
  ctaLabel: {
    ...typography.caption,
    color: colors.textOnPrimary,
    fontWeight: '700',
  },
});
