import { Lightbulb } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/theme';

import { InlineBoldText } from './InlineBoldText';

type TipCardProps = {
  tipKey: string;
};

export function TipCard({ tipKey }: TipCardProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Lightbulb size={16} color={colors.accentGoldPressed} strokeWidth={2.25} />
        <Text style={styles.title}>{t('culture.bozUy.tipLabel')}</Text>
      </View>
      <InlineBoldText text={t(tipKey)} style={styles.body} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    gap: spacing.xxs,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.lg,
    padding: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  title: {
    ...typography.caption,
    color: colors.accentGoldPressed,
    fontWeight: '700',
  },
  body: {
    ...typography.small,
    color: colors.textSecondary,
    lineHeight: 16,
  },
});
