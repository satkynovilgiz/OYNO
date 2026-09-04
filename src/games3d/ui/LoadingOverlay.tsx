import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing, typography } from '@/theme';

type LoadingOverlayProps = {
  progress?: number;
};

/** Full-bleed loading state (Section 64) - never a blank screen while
 * models/assets load. */
export function LoadingOverlay({ progress }: LoadingOverlayProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.root}>
      <ActivityIndicator size="large" color={colors.accentGold} />
      <Text style={styles.text}>{t('games3d.loading.title')}</Text>
      {typeof progress === 'number' ? (
        <Text style={styles.progress}>{Math.round(progress * 100)}%</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  text: {
    ...typography.bodyBold,
    color: colors.textOnDark,
  },
  progress: {
    ...typography.small,
    color: 'rgba(255,255,255,0.7)',
  },
});
