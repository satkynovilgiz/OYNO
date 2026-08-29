import { useTranslation } from 'react-i18next';

import { ConfirmationModal } from '@/components/ui';

type UnsavedChangesModalProps = {
  visible: boolean;
  onDiscard: () => void;
  onKeepEditing: () => void;
};

/** Shown when closing the editor (X / back) with unsaved edits - spec
 * section 3's "show confirmation before leaving." */
export function UnsavedChangesModal({ visible, onDiscard, onKeepEditing }: UnsavedChangesModalProps) {
  const { t } = useTranslation();

  return (
    <ConfirmationModal
      visible={visible}
      title={t('avatar.unsavedChangesTitle')}
      message={t('avatar.unsavedChangesMessage')}
      confirmLabel={t('avatar.unsavedChangesConfirm')}
      cancelLabel={t('avatar.unsavedChangesCancel')}
      destructive
      onConfirm={onDiscard}
      onCancel={onKeepEditing}
    />
  );
}
