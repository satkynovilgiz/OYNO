import { TriangleAlert } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { colors, spacing, typography } from '@/theme';

type ErrorOverlayProps = {
  onRetry: () => void;
  onExit: () => void;
};

/** Friendly error state (Section 63) - never a black screen if the 3D scene
 * fails to mount or load its assets. */
export function ErrorOverlay({ onRetry, onExit }: ErrorOverlayProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.root}>
      <TriangleAlert size={40} color={colors.accentGold} strokeWidth={1.75} />
      <Text style={styles.title}>{t('games3d.error.title')}</Text>
      <Text style={styles.message}>{t('games3d.error.message')}</Text>
      <View style={styles.actions}>
        <Button label={t('games3d.error.retry')} onPress={onRetry} />
        <Button label={t('games3d.error.exit')} variant="secondary" onPress={onExit} />
      </View>
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
    padding: spacing.xl,
  },
  title: {
    ...typography.h1,
    color: colors.textOnDark,
    textAlign: 'center',
  },
  message: {
    ...typography.body,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
