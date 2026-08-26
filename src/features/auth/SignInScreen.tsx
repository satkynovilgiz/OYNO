import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, TextButton, TextField } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';

type SignInScreenProps = {
  onSubmit: (input: { email: string; password: string }) => Promise<boolean>;
  isSubmitting: boolean;
  serverError: string | null;
  onPressSignUp: () => void;
  onPressForgotPassword: () => void;
  onPressGoogle: () => Promise<void>;
  onPressApple: () => Promise<void>;
};

export function SignInScreen({
  onSubmit,
  isSubmitting,
  serverError,
  onPressSignUp,
  onPressForgotPassword,
  onPressGoogle,
  onPressApple,
}: SignInScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = (): boolean => {
    const nextErrors: { email?: string; password?: string } = {};
    if (!email.trim()) nextErrors.email = t('auth.signIn.emailError');
    if (!password) nextErrors.password = t('auth.signIn.passwordError');
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    await onSubmit({ email: email.trim(), password });
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>{t('auth.signIn.title')}</Text>

      <View style={styles.form}>
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
          autoComplete="password"
        />

        <TextButton
          label={t('auth.signIn.forgotPassword')}
          onPress={onPressForgotPassword}
          style={styles.forgotLink}
        />

        {serverError ? <Text style={styles.serverError}>{serverError}</Text> : null}

        <Button label={t('auth.signIn.submit')} onPress={handleSubmit} loading={isSubmitting} />

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t('auth.signIn.or')}</Text>
          <View style={styles.dividerLine} />
        </View>

        <Button label={t('auth.signIn.continueWithGoogle')} variant="secondary" onPress={onPressGoogle} disabled={isSubmitting} />
        <Button label={t('auth.signIn.continueWithApple')} variant="secondary" onPress={onPressApple} disabled={isSubmitting} />
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.footerText}>{t('auth.signIn.noAccount')}</Text>
        <TextButton label={t('auth.signIn.signUpLink')} onPress={onPressSignUp} />
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
  forgotLink: {
    alignSelf: 'flex-end',
  },
  serverError: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
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
