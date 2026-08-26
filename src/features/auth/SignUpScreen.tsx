import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, TextButton, TextField } from '@/components/ui';
import { colors, radii, spacing, typography } from '@/theme';

type FieldErrors = Partial<Record<'name' | 'email' | 'password' | 'confirmPassword', string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

type SignUpScreenProps = {
  onSubmit: (input: { name: string; email: string; password: string }) => Promise<boolean>;
  isSubmitting: boolean;
  serverError: string | null;
  onPressSignIn: () => void;
  onPressGoogle: () => Promise<void>;
  onPressApple: () => Promise<void>;
};

export function SignUpScreen({ onSubmit, isSubmitting, serverError, onPressSignIn, onPressGoogle, onPressApple }: SignUpScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});

  const validate = (): boolean => {
    const nextErrors: FieldErrors = {};
    if (!name.trim()) nextErrors.name = t('auth.signUp.nameError');
    if (!EMAIL_PATTERN.test(email.trim())) nextErrors.email = t('auth.signUp.emailError');
    if (password.length < MIN_PASSWORD_LENGTH) {
      nextErrors.password = t('auth.signUp.passwordError', { count: MIN_PASSWORD_LENGTH });
    }
    if (confirmPassword !== password) nextErrors.confirmPassword = t('auth.signUp.confirmPasswordError');
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    await onSubmit({ name: name.trim(), email: email.trim(), password });
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>{t('auth.signUp.title')}</Text>

      <View style={styles.form}>
        <TextField
          label={t('auth.signUp.nameLabel')}
          value={name}
          onChangeText={setName}
          error={errors.name}
          placeholder={t('auth.signUp.namePlaceholder')}
        />
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          error={errors.email}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoComplete="email"
        />
        <TextField
          label={t('auth.signIn.passwordLabel')}
          value={password}
          onChangeText={setPassword}
          error={errors.password}
          secure
          autoComplete="password-new"
        />
        <TextField
          label={t('auth.signUp.confirmPasswordLabel')}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          error={errors.confirmPassword}
          secure
        />

        {serverError ? <Text style={styles.serverError}>{serverError}</Text> : null}

        <Button label={t('auth.signUp.submit')} onPress={handleSubmit} loading={isSubmitting} />

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t('auth.signIn.or')}</Text>
          <View style={styles.dividerLine} />
        </View>

        <Button label={t('auth.signIn.continueWithGoogle')} variant="secondary" onPress={onPressGoogle} disabled={isSubmitting} />
        <Button label={t('auth.signIn.continueWithApple')} variant="secondary" onPress={onPressApple} disabled={isSubmitting} />
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.footerText}>{t('auth.signUp.hasAccount')}</Text>
        <TextButton label={t('auth.signUp.signInLink')} onPress={onPressSignIn} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.xl,
    gap: spacing.xl,
  },
  title: {
    ...typography.display,
    color: colors.textPrimary,
  },
  form: {
    gap: spacing.md,
  },
  serverError: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.sm,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.surfaceBorder,
  },
  dividerText: {
    ...typography.small,
    color: colors.textMuted,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xxs,
  },
  footerText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
