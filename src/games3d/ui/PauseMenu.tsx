import { Modal, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { colors, radii, spacing, typography } from '@/theme';

type PauseMenuProps = {
  visible: boolean;
  onResume: () => void;
  onRestart: () => void;
  onExit: () => void;
};

/** Shared pause menu (Section 21) for every 3D game - landscape-friendly
 * centered sheet rather than a bottom sheet, since these games lock to
 * landscape. */
export function PauseMenu({ visible, onResume, onRestart, onExit }: PauseMenuProps) {
  const { t } = useTranslation();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onResume}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{t('games3d.pause.title')}</Text>
          <View style={styles.actions}>
            <Button label={t('games3d.pause.resume')} onPress={onResume} />
            <Button label={t('games3d.pause.restart')} variant="secondary" onPress={onRestart} />
            <Button label={t('games3d.pause.exit')} variant="danger" onPress={onExit} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20,14,8,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: {
    width: 320,
    maxWidth: '80%',
    backgroundColor: colors.surface,
    borderRadius: radii.xxl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  actions: {
    gap: spacing.sm,
  },
});
