import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, StyleSheet, Text, View } from 'react-native';

import { Button, TextField } from '@/components/ui';
import { colors, radii, spacing, typography } from '@/theme';

type SaveModalProps = {
  visible: boolean;
  defaultName: string;
  isSaving: boolean;
  isGuest: boolean;
  hasError: boolean;
  onSave: (name: string) => void;
  onCancel: () => void;
};

/** Save can fail two distinct ways - a guest with no account (expected,
 * progress never persists for guests anywhere in the app) or a real error
 * (network, server). Both used to fail the exact same way: the modal just
 * silently stayed open with no explanation, which is exactly the kind of
 * dead-end interaction the task calls out - each now gets its own message
 * instead of a silent no-op. */
export function SaveModal({ visible, defaultName, isSaving, isGuest, hasError, onSave, onCancel }: SaveModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(defaultName);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{t('culture.oymo.save.title')}</Text>
          <TextField label={t('culture.oymo.save.nameLabel')} value={name} onChangeText={setName} />
          {isGuest && <Text style={styles.hint}>{t('culture.oymo.save.guestHint')}</Text>}
          {!isGuest && hasError && <Text style={styles.error}>{t('culture.oymo.save.error')}</Text>}
          <View style={styles.actions}>
            <View style={styles.actionItem}>
              <Button label={t('common.cancel')} variant="secondary" onPress={onCancel} disabled={isSaving} />
            </View>
            <View style={styles.actionItem}>
              <Button label={t('culture.oymo.save.confirm')} onPress={() => onSave(name.trim() || defaultName)} loading={isSaving} />
            </View>
          </View>
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
  hint: {
    ...typography.small,
    color: colors.textSecondary,
  },
  error: {
    ...typography.small,
    color: colors.danger,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionItem: {
    flex: 1,
  },
});
