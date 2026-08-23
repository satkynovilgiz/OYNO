import { CheckCircle2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, TextField } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';

type FieldErrors = { password?: string; confirmPassword?: string };

const MIN_PASSWORD_LENGTH = 8;

type ResetPasswordScreenProps = {
  onSubmit: (newPassword: string) => Promise<boolean>;
  isSubmitting: boolean;
  serverError: string | null;
  onPressSignIn: () => void;
};

export function ResetPasswordScreen({ onSubmit, isSubmitting, serverError, onPressSignIn }: ResetPasswordScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [succeeded, setSucceeded] = useState(false);

  const handleSubmit = async () => {
    const nextErrors: FieldErrors = {};
    if (password.length < MIN_PASSWORD_LENGTH) {
      nextErrors.password = t('auth.resetPassword.passwordError', { count: MIN_PASSWORD_LENGTH });
    }
    if (confirmPassword !== password) nextErrors.confirmPassword = t('auth.resetPassword.confirmPasswordError');
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const ok = await onSubmit(password);
    if (ok) setSucceeded(true);
  };

  if (succeeded) {
    return (
      <View style={[styles.root, styles.successRoot, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={styles.successContent}>
          <CheckCircle2 size={64} color={colors.primary} strokeWidth={1.5} />
          <Text style={styles.successTitle}>{t('auth.resetPassword.successTitle')}</Text>
        </View>
        <Button label={t('auth.resetPassword.successCta')} onPress={onPressSignIn} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl }]}>
      <View style={styles.content}>
        <Text style={styles.title}>{t('auth.resetPassword.title')}</Text>

        <TextField
          label={t('auth.resetPassword.newPasswordLabel')}
          value={password}
          onChangeText={setPassword}
          error={errors.password}
          secure
        />
        <TextField
          label={t('auth.resetPassword.confirmPasswordLabel')}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          error={errors.confirmPassword}
          secure
        />

        {serverError ? <Text style={styles.serverError}>{serverError}</Text> : null}
      </View>

      <Button label={t('auth.resetPassword.submit')} onPress={handleSubmit} loading={isSubmitting} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
  },
  content: {
    gap: spacing.md,
  },
  title: {
    ...typography.display,
    color: colors.textPrimary,
  },
  serverError: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.sm,
  },
  successRoot: {
    alignItems: 'center',
  },
  successContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  successTitle: {
    ...typography.h1,
    color: colors.textPrimary,
    textAlign: 'center',
  },
});
