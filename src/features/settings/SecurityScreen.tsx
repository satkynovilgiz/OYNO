import { Laptop2, LogOut } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, TextField } from '@/components/ui';
import { colors, radii, spacing, typography } from '@/theme';

import { SettingsScreenLayout } from './components/SettingsScreenLayout';

type SecurityScreenProps = {
  isSubmitting: boolean;
  error: string | null;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  onSignOutAllSessions: () => Promise<void>;
  onPressBack: () => void;
};

export function SecurityScreen({ isSubmitting, error, onChangePassword, onSignOutAllSessions, onPressBack }: SecurityScreenProps) {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ newPassword?: string; confirmPassword?: string }>({});
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSubmit = async () => {
    setSavedNotice(false);
    const errors: typeof fieldErrors = {};
    if (newPassword.length < 8) errors.newPassword = t('settings.security.passwordTooShort');
    if (confirmPassword !== newPassword) errors.confirmPassword = t('settings.security.passwordMismatch');
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const ok = await onChangePassword(currentPassword, newPassword);
    if (ok) {
      setSavedNotice(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  return (
    <SettingsScreenLayout title={t('settings.security.title')} onPressBack={onPressBack}>
      <View style={styles.form}>
        <Text style={styles.sectionTitle}>{t('settings.security.changePasswordTitle')}</Text>
        <TextField label={t('settings.security.currentPasswordLabel')} value={currentPassword} onChangeText={setCurrentPassword} secure />
        <TextField
          label={t('settings.security.newPasswordLabel')}
          value={newPassword}
          onChangeText={setNewPassword}
          error={fieldErrors.newPassword}
          secure
        />
        <TextField
          label={t('settings.security.confirmPasswordLabel')}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          error={fieldErrors.confirmPassword}
          secure
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {savedNotice ? <Text style={styles.saved}>{t('settings.security.saved')}</Text> : null}
        <Button label={t('settings.security.submit')} onPress={handleSubmit} loading={isSubmitting} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.security.activeSessionsTitle')}</Text>
        <View style={styles.sessionCard}>
          <View style={styles.sessionIconWrap}>
            <Laptop2 size={20} color={colors.primary} strokeWidth={1.75} />
          </View>
          <View style={styles.sessionBody}>
            <Text style={styles.sessionTitle}>{t('settings.security.thisDevice')}</Text>
            <Text style={styles.sessionMeta}>{t('settings.security.sessionsUnavailable')}</Text>
          </View>
        </View>

        <Button
          label={t('settings.security.signOutAll')}
          variant="secondary"
          icon={<LogOut size={16} color={colors.primary} strokeWidth={2} />}
          onPress={onSignOutAllSessions}
        />
      </View>
    </SettingsScreenLayout>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.overline,
    color: colors.textSecondary,
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
  section: {
    gap: spacing.sm,
  },
  sessionCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.sm,
  },
  sessionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionBody: {
    flex: 1,
    gap: 2,
  },
  sessionTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  sessionMeta: {
    ...typography.small,
    color: colors.textSecondary,
  },
});
