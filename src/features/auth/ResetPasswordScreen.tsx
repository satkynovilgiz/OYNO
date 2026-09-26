import { CircleCheck } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, TextField } from '@/components/ui';
import { colors, spacing, textStyles } from '@/theme';

import { AuthShell, FormMessage } from './AuthShell';
import { MIN_PASSWORD_LENGTH, validateNewPassword, type FieldErrors } from './authValidation';

type ResetPasswordScreenProps = {
  onSubmit: (newPassword: string) => Promise<boolean>;
  isSubmitting: boolean;
  serverError: string | null;
  onPressSignIn: () => void;
  /** Expired / invalid reset session: start over with a new code. */
  onRequestNewCode: () => void;
  expired: boolean;
};

/** Step 3 of reset: the new password (typed twice - there's no other way
 * to check it before it replaces the old one), then a clear success state
 * that sends the person to Sign in with it. */
export function ResetPasswordScreen({ onSubmit, isSubmitting, serverError, onPressSignIn, onRequestNewCode, expired }: ResetPasswordScreenProps) {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors<'password' | 'confirmPassword'>>({});
  const [succeeded, setSucceeded] = useState(false);
  const confirmRef = useRef<TextInput>(null);

  const handleSubmit = async () => {
    if (isSubmitting) return;
    const next = validateNewPassword({ password, confirmPassword });
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    if (await onSubmit(password)) setSucceeded(true);
  };

  if (succeeded) {
    return (
      <AuthShell hero="compact" title={t('auth.v2.reset.successTitle')} subtitle={t('auth.v2.reset.successBody')}>
        <View style={styles.success} accessibilityLiveRegion="polite">
          <CircleCheck size={40} color={colors.success} strokeWidth={1.75} />
        </View>
        <Button label={t('auth.resetPassword.successCta')} size="lg" block onPress={onPressSignIn} />
      </AuthShell>
    );
  }

  if (expired) {
    return (
      <AuthShell hero="compact" title={t('auth.v2.reset.expiredTitle')} subtitle={t('auth.v2.errors.resetExpired')}>
        <Button label={t('auth.v2.resetCode.newCode')} size="lg" block onPress={onRequestNewCode} />
        <Button label={t('auth.resetPassword.successCta')} variant="text" block onPress={onPressSignIn} />
      </AuthShell>
    );
  }

  return (
    <AuthShell hero="compact" title={t('auth.resetPassword.title')} subtitle={t('auth.v2.reset.subtitle')}>
      <TextField
        label={t('auth.resetPassword.newPasswordLabel')}
        value={password}
        onChangeText={(value) => {
          setPassword(value);
          if (errors.password) setErrors((current) => ({ ...current, password: undefined }));
        }}
        error={errors.password ? t(errors.password, { count: MIN_PASSWORD_LENGTH }) : null}
        hint={t('auth.v2.passwordRule', { count: MIN_PASSWORD_LENGTH })}
        secure
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => confirmRef.current?.focus()}
        autoFocus
      />
      <TextField
        inputRef={confirmRef}
        label={t('auth.resetPassword.confirmPasswordLabel')}
        value={confirmPassword}
        onChangeText={(value) => {
          setConfirmPassword(value);
          if (errors.confirmPassword) setErrors((current) => ({ ...current, confirmPassword: undefined }));
        }}
        error={errors.confirmPassword ? t(errors.confirmPassword) : null}
        secure
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="done"
        onSubmitEditing={handleSubmit}
      />
      <FormMessage tone="error" message={serverError} />
      <Button label={t('auth.resetPassword.submit')} size="lg" block onPress={handleSubmit} loading={isSubmitting} />
      <Text style={styles.note}>{t('auth.v2.reset.signInAfter')}</Text>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  success: { alignItems: 'center', paddingVertical: spacing.sm },
  note: { ...textStyles.small, color: colors.textMuted, textAlign: 'center' },
});
