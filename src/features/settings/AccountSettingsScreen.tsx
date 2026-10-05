import { KeyRound, ShieldAlert, Sparkles, Trash2, Users } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, ConfirmationModal, TextField } from '@/components/ui';
import { Chip } from '@/components/ui/Chip';
import type { AuthUser, DeletionConfirmation, DeletionOptions, OAuthProvider } from '@/services/auth';
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
  /** Confirmation choices for this account (password and/or linked providers); null = no usable session. */
  loadDeletionOptions: () => Promise<DeletionOptions | null>;
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
  loadDeletionOptions,
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
  const [deleteOptions, setDeleteOptions] = useState<DeletionOptions | null | 'loading'>('loading');
  // Which confirmation the person chose: 'password' or a linked provider.
  const [deleteChoice, setDeleteChoice] = useState<'password' | OAuthProvider | null>(null);
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
    setDeleteOptions('loading');
    setDeleteChoice(null);
    const options = await loadDeletionOptions().catch(() => null);
    setDeleteOptions(options);
    // A sensible default; every available choice stays selectable.
    setDeleteChoice(options ? (options.password ? 'password' : (options.providers[0] ?? null)) : null);
  };

  const closeDelete = () => {
    setDeleteVisible(false);
    setDeletePassword('');
    setDeleteError(null);
    setDeleteFailed(false);
  };

  const handleConfirmDelete = async () => {
    if (deleteOptions === 'loading') return;
    if (!deleteOptions || !deleteChoice) {
      setDeleteError(t('auth.v2.errors.sessionEnded'));
      return;
    }
    if (deleteChoice === 'password' && !deletePassword) {
      setDeleteError(t('settings.account.deletePasswordError'));
      return;
    }
    setDeleteError(null);
    setDeleteFailed(false);
    setIsDeleting(true);
    const result = await onDeleteAccount(deleteChoice === 'password' ? { kind: 'password', password: deletePassword } : { kind: 'oauth', provider: deleteChoice });
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

  const nameOf = (provider: OAuthProvider) => (provider === 'apple' ? 'Apple' : 'Google');
  const providerName = deleteChoice && deleteChoice !== 'password' ? nameOf(deleteChoice) : null;
  const choices: ('password' | OAuthProvider)[] = deleteOptions && deleteOptions !== 'loading' ? [...(deleteOptions.password ? (['password'] as const) : []), ...deleteOptions.providers] : [];

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
        {choices.length > 1 ? (
          <View style={styles.choices} accessibilityRole="radiogroup" accessibilityLabel={t('settings.account.deleteConfirmHow')}>
            {choices.map((choice) => (
              <Chip
                key={choice}
                label={choice === 'password' ? t('settings.account.deleteWithPassword') : t('settings.account.deleteConfirmWithProvider', { provider: nameOf(choice) })}
                selected={deleteChoice === choice}
                onPress={() => {
                  setDeleteChoice(choice);
                  setDeleteError(null);
                  setDeleteFailed(false);
                }}
              />
            ))}
          </View>
        ) : null}
        {deleteChoice === 'password' ? (
          <TextField label={t('settings.account.passwordLabel')} value={deletePassword} onChangeText={setDeletePassword} error={deleteError ?? (deleteFailed ? error : null)} secure />
        ) : (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {deleteError ?? (deleteFailed ? error : null) ?? (deleteOptions === null ? t('auth.v2.errors.sessionEnded') : '')}
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
  choices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
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
