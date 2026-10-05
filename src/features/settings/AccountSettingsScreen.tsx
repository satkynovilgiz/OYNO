import { KeyRound, ShieldAlert, Sparkles, Trash2, Users } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, ConfirmationModal, TextField } from '@/components/ui';
import type { AuthUser, DeletionConfirmation, DeletionMethod } from '@/services/auth';
import { colors, radii, spacing, typography } from '@/theme';

import { SettingsRow, SettingsSection } from './components/SettingsRow';
import { SettingsScreenLayout } from './components/SettingsScreenLayout';

type AccountSettingsScreenProps = {
  user: AuthUser;
  isSubmitting: boolean;
  error: string | null;
  onPressBack: () => void;
  onSaveProfile: (input: { name: string; email: string }) => Promise<boolean>;
  onPressChangePassword: () => void;
  /** true = deleted, 'cancelled' = provider sheet closed (silent), false = failed (`error` is set). */
  onDeleteAccount: (confirmation: DeletionConfirmation) => Promise<boolean | 'cancelled'>;
  /** How this account confirms deletion (password, or its sign-in provider); null = no usable session. */
  loadDeletionMethod: () => Promise<DeletionMethod | null>;
  onPressCustomizeAvatar: () => void;
  onPressStoryCompanion: () => void;
};

export function AccountSettingsScreen({
  user,
  isSubmitting,
  error,
  onPressBack,
  onSaveProfile,
  onPressChangePassword,
  onDeleteAccount,
  loadDeletionMethod,
  onPressCustomizeAvatar,
  onPressStoryCompanion,
}: AccountSettingsScreenProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [savedNotice, setSavedNotice] = useState(false);

  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteMethod, setDeleteMethod] = useState<DeletionMethod | null | 'loading'>('loading');
  const [deleteFailed, setDeleteFailed] = useState(false);

  const hasChanges = name.trim() !== user.name || email.trim().toLowerCase() !== user.email;

  const handleSave = async () => {
    setSavedNotice(false);
    const ok = await onSaveProfile({ name: name.trim(), email: email.trim() });
    if (ok) setSavedNotice(true);
  };

  const openDelete = async () => {
    setDeleteVisible(true);
    setDeleteError(null);
    setDeleteFailed(false);
    setDeleteMethod('loading');
    const method = await loadDeletionMethod().catch(() => null);
    setDeleteMethod(method);
  };

  const closeDelete = () => {
    setDeleteVisible(false);
    setDeletePassword('');
    setDeleteError(null);
    setDeleteFailed(false);
  };

  const handleConfirmDelete = async () => {
    if (deleteMethod === 'loading') return;
    if (!deleteMethod) {
      setDeleteError(t('auth.v2.errors.sessionEnded'));
      return;
    }
    if (deleteMethod.kind === 'password' && !deletePassword) {
      setDeleteError(t('settings.account.deletePasswordError'));
      return;
    }
    setDeleteError(null);
    setDeleteFailed(false);
    setIsDeleting(true);
    const result = await onDeleteAccount(deleteMethod.kind === 'password' ? { kind: 'password', password: deletePassword } : { kind: 'oauth', provider: deleteMethod.provider });
    setIsDeleting(false);
    // Closing the provider sheet is not an error: stay in the dialog, nothing deleted.
    if (result === 'cancelled') return;
    if (!result) {
      // The real reason (wrong password, different account, offline, server) comes from the store.
      setDeleteFailed(true);
      return;
    }
    closeDelete();
  };

  const providerName = deleteMethod && deleteMethod !== 'loading' && deleteMethod.kind === 'oauth' ? (deleteMethod.provider === 'apple' ? 'Apple' : 'Google') : null;

  return (
    <SettingsScreenLayout title={t('settings.account.title')} onPressBack={onPressBack}>
      <View style={styles.form}>
        <TextField
          label={t('settings.account.nameLabel')}
          value={name}
          onChangeText={setName}
          placeholder={t('settings.account.namePlaceholder')}
        />
        <TextField label={t('auth.emailLabel')} value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {savedNotice && !hasChanges ? <Text style={styles.saved}>{t('settings.account.savedLabel')}</Text> : null}

        <Button label={t('settings.account.save')} onPress={handleSave} loading={isSubmitting} disabled={!hasChanges} />
      </View>

      <View style={styles.group}>
        <SettingsSection>
          <SettingsRow icon={Sparkles} label={t('settings.account.customizeAvatar')} onPress={onPressCustomizeAvatar} />
          <SettingsRow icon={Users} label={t('settings.account.storyCompanion')} onPress={onPressStoryCompanion} />
          <SettingsRow icon={KeyRound} label={t('settings.account.changePassword')} onPress={onPressChangePassword} />
        </SettingsSection>
        {/* Deleting the account is set apart from ordinary rows. */}
        <SettingsSection>
          <SettingsRow icon={Trash2} label={t('settings.account.deleteAccount')} destructive showChevron={false} onPress={() => void openDelete()} />
        </SettingsSection>
      </View>

      <ConfirmationModal
        visible={deleteVisible}
        title={t('settings.account.deleteModalTitle')}
        message={t('settings.account.deleteModalMessage')}
        confirmLabel={providerName ? t('settings.account.deleteConfirmWithProvider', { provider: providerName }) : t('settings.account.deleteConfirm')}
        cancelLabel={t('settings.account.deleteCancel')}
        destructive
        isConfirming={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={closeDelete}
      >
        <View style={styles.deleteWarning}>
          <ShieldAlert size={16} color={colors.danger} strokeWidth={2} />
          <Text style={styles.deleteWarningText}>{providerName ? t('settings.account.deleteOAuthHint') : t('settings.account.deleteConfirmHint')}</Text>
        </View>
        {deleteMethod && deleteMethod !== 'loading' && deleteMethod.kind === 'password' ? (
          <TextField label={t('settings.account.passwordLabel')} value={deletePassword} onChangeText={setDeletePassword} error={deleteError ?? (deleteFailed ? error : null)} secure />
        ) : (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {deleteError ?? (deleteFailed ? error : null) ?? (deleteMethod === null ? t('auth.v2.errors.sessionEnded') : '')}
          </Text>
        )}
      </ConfirmationModal>
    </SettingsScreenLayout>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.sm,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
  },
  saved: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  group: {
    gap: spacing.md,
  },
  deleteWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(214,69,69,0.1)',
    borderRadius: radii.md,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  deleteWarningText: {
    ...typography.small,
    color: colors.danger,
    flex: 1,
  },
});
