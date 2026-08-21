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
      <Text style={styles.title}>{t('culture.quiz.title')}</Text>
      <Text style={styles.description}>{t('culture.quiz.description')}</Text>

      <View style={styles.footer}>
        <AnimatedPressable style={styles.cta} onPress={onPress} accessibilityRole="button" accessibilityLabel={t('culture.quiz.cta')}>
          <Text style={styles.ctaLabel}>{t('culture.quiz.cta')}</Text>
          <ArrowRight size={14} color={colors.textOnPrimary} strokeWidth={2.5} />
        </AnimatedPressable>
        <IconChip icon={GraduationCap} size={44} iconSize={22} color={colors.primary} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.sm,
    gap: spacing.xxs,
    ...shadows.card,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  description: {
    ...typography.small,
    color: colors.textSecondary,
    lineHeight: 15,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xxs,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
  ctaLabel: {
    ...typography.caption,
    color: colors.textOnPrimary,
    fontWeight: '700',
  },
});
