import { ArrowRight, GraduationCap } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable, IconChip } from '@/components/ui';
import { colors, radii, shadows, spacing, typography } from '@/theme';

type QuizTeaserCardProps = {
  onPress?: () => void;
};

export function QuizTeaserCard({ onPress }: QuizTeaserCardProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.card}>
      <View style={styles.textCol}>
        <Text style={styles.title}>{t('culture.quiz.title')}</Text>
        <Text style={styles.description}>{t('culture.quiz.description')}</Text>

        <AnimatedPressable style={styles.cta} onPress={onPress} accessibilityRole="button" accessibilityLabel={t('culture.quiz.cta')}>
          <Text style={styles.ctaLabel}>{t('culture.quiz.cta')}</Text>
          <ArrowRight size={14} color={colors.textOnPrimary} strokeWidth={2.5} />
        </AnimatedPressable>
      </View>
      <IconChip icon={GraduationCap} size={56} iconSize={26} color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.sm,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    ...shadows.card,
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
