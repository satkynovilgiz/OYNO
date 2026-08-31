import { useTranslation } from 'react-i18next';
import { Modal, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { colors, radii, spacing, typography } from '@/theme';

type TipsModalProps = {
  visible: boolean;
  onClose: () => void;
};

/** Builder-wide help panel opened from the header's "Кеңештер" button -
 * separate from the per-step "Кеңеш" card (TipCard). Content is app-usage
 * guidance, not a cultural claim, so it doesn't need a verified source. */
export function TipsModal({ visible, onClose }: TipsModalProps) {
  const { t } = useTranslation();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{t('culture.bozUy.tipsModal.title')}</Text>
          {(t('culture.bozUy.tipsModal.items', { returnObjects: true }) as string[]).map((item, index) => (
            <Text key={index} style={styles.item}>
              • {item}
            </Text>
          ))}
          <Button label={t('culture.bozUy.tipsModal.close')} onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20,14,8,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  item: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
