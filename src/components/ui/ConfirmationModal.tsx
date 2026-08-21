import { type ReactNode } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/theme';

import { Button } from './Button';

type ConfirmationModalProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Renders the confirm button in danger styling for destructive actions
   * (sign out, delete account). */
  destructive?: boolean;
  isConfirming?: boolean;
  children?: ReactNode;
};

/** Generic confirm/cancel dialog (spec Section 83) - used for sign-out and
 * delete-account so neither is a single accidental tap. */
export function ConfirmationModal({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  destructive = false,
  isConfirming = false,
  children,
}: ConfirmationModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          {children}

          <View style={styles.actions}>
            <View style={styles.actionItem}>
              <Button label={cancelLabel} variant="secondary" onPress={onCancel} disabled={isConfirming} />
            </View>
            <View style={styles.actionItem}>
              <Button
                label={confirmLabel}
                onPress={onConfirm}
                loading={isConfirming}
                variant={destructive ? 'danger' : 'primary'}
              />
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
  message: {
    ...typography.body,
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionItem: {
    flex: 1,
    alignItems: 'stretch',
  },
});
