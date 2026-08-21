import { KeyRound, ShieldAlert, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, ConfirmationModal, TextField } from '@/components/ui';
import type { AuthUser } from '@/services/auth';
import { colors, radii, spacing, typography } from '@/theme';

import { SettingsRow } from './components/SettingsRow';
import { SettingsScreenLayout } from './components/SettingsScreenLayout';

type AccountSettingsScreenProps = {
  user: AuthUser;
  isSubmitting: boolean;
  error: string | null;
  onPressBack: () => void;
  onSaveProfile: (input: { name: string; email: string }) => Promise<boolean>;
  onPressChangePassword: () => void;
  onDeleteAccount: (password: string) => Promise<boolean>;
};

export function AccountSettingsScreen({
  user,
  isSubmitting,
  error,
  onPressBack,
  onSaveProfile,
  onPressChangePassword,
  onDeleteAccount,
}: AccountSettingsScreenProps) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [savedNotice, setSavedNotice] = useState(false);

  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const hasChanges = name.trim() !== user.name || email.trim().toLowerCase() !== user.email;

  const handleSave = async () => {
    setSavedNotice(false);
    const ok = await onSaveProfile({ name: name.trim(), email: email.trim() });
    if (ok) setSavedNotice(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletePassword) {
      setDeleteError('Сырсөзүңүздү жазыңыз.');
      return;
    }
    setIsDeleting(true);
    const ok = await onDeleteAccount(deletePassword);
    setIsDeleting(false);
    if (!ok) {
      setDeleteError('Сырсөз туура эмес.');
      return;
    }
    setDeleteVisible(false);
  };

  return (
    <SettingsScreenLayout title="Аккаунт" onPressBack={onPressBack}>
      <View style={styles.form}>
        <TextField label="Аты-жөнү" value={name} onChangeText={setName} placeholder="Бек Асанов" />
        <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {savedNotice && !hasChanges ? <Text style={styles.saved}>Сакталды ✓</Text> : null}

        <Button label="Сактоо" onPress={handleSave} loading={isSubmitting} disabled={!hasChanges} />
      </View>

      <View style={styles.group}>
        <SettingsRow icon={KeyRound} label="Сырсөздү өзгөртүү" onPress={onPressChangePassword} />
        <SettingsRow
          icon={Trash2}
          label="Аккаунтту өчүрүү"
          destructive
          showChevron={false}
          onPress={() => setDeleteVisible(true)}
        />
      </View>

      <ConfirmationModal
        visible={deleteVisible}
        title="Аккаунтту өчүрүү"
        message="Бул аракетти артка кайтаруу мүмкүн эмес. Бардык прогрессиңиз (XP, коллекция, жетишкендиктер) биротоло өчүрүлөт."
        confirmLabel="Өчүрүү"
        cancelLabel="Жок"
        destructive
        isConfirming={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setDeleteVisible(false);
          setDeletePassword('');
          setDeleteError(null);
        }}
      >
        <View style={styles.deleteWarning}>
          <ShieldAlert size={16} color={colors.danger} strokeWidth={2} />
          <Text style={styles.deleteWarningText}>Ырастоо үчүн сырсөзүңүздү жазыңыз.</Text>
        </View>
        <TextField label="Сырсөз" value={deletePassword} onChangeText={setDeletePassword} error={deleteError} secure />
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
    gap: spacing.xs,
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
