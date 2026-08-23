import { Lock } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, radii, spacing, typography } from '@/theme';

export function ComingSoonCard() {
  const { t } = useTranslation();

  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <Lock size={22} color={colors.textOnDark} strokeWidth={1.75} />
      </View>
      <Text style={styles.title}>{t('games.comingSoon.title')}</Text>
      <Text style={styles.subtitle}>{t('games.comingSoon.subtitle')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '47%',
    aspectRatio: 0.72,
    borderRadius: radii.xl,
    backgroundColor: colors.primaryPressed,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.md,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.bodyBold,
    color: colors.textOnDark,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.small,
    color: 'rgba(255,255,255,0.75)',
  },
});
