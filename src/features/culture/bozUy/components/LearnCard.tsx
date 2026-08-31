import { BookOpen } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';

/** The general (not per-step) Boz Üy fact, sourced from the verified
 * culture_items row `boz-uy-overview` (cultural_meaning field) rather than
 * the design mock's own unsourced sentence - see the plan for why. */
export function LearnCard() {
  const { t } = useTranslation();

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <BookOpen size={16} color={colors.primary} strokeWidth={2.25} />
        <Text style={styles.title}>{t('culture.bozUy.learnCard.title')}</Text>
      </View>
      <Text style={styles.body}>{t('culture.bozUy.learnCard.body')}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.xxs,
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  title: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  body: {
    ...typography.small,
    color: colors.textSecondary,
    lineHeight: 16,
  },
});
