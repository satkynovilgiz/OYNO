import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable, Button, OtpCodeInput, TextButton } from '@/components/ui';
import { cardRadii, colors, spacing, textStyles } from '@/theme';

import { AuthShell, FormMessage } from './AuthShell';

const RESEND_COOLDOWN_SECONDS = 30;

type VerifyEmailScreenProps = {
  email: string;
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (code: string) => void;
  onResend: () => Promise<boolean>;
  onChangeEmail: () => void;
  onBackToSignIn: () => void;
};

/** Email verification after Create account: the 8-digit code, a resend
 * that only ever happens on tap (with a cooldown - never automatic), and
 * clear ways out (change email / back to sign in). */
export function VerifyEmailScreen({ email, isSubmitting, error, onSubmit, onResend, onChangeEmail, onBackToSignIn }: VerifyEmailScreenProps) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [isResending, setIsResending] = useState(false);
  const [resendConfirmed, setResendConfirmed] = useState(false);
  const autoSubmittedCodeRef = useRef<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    if (localError && code.length === 8) setLocalError(null);
  }, [code, localError]);

  const handleSubmit = () => {
    if (isSubmitting) return;
    if (code.length !== 8) {
      setLocalError(t('auth.verifyEmail.codeError'));
      return;
    }
    setLocalError(null);
    onSubmit(code);
  };

  // Auto-submit once all 8 digits are entered; the button stays as the
  // retry path after a failed attempt (the code is left unchanged).
  useEffect(() => {
    if (code.length === 8 && code !== autoSubmittedCodeRef.current && !isSubmitting) {
      autoSubmittedCodeRef.current = code;
      handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, isSubmitting]);

  const handleResend = async () => {
    if (cooldown > 0 || isResending) return;
    setIsResending(true);
    setResendConfirmed(false);
    const ok = await onResend();
    setIsResending(false);
    if (ok) {
      setResendConfirmed(true);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    }
  };

  const shownError = localError ?? error;
  const resendDisabled = cooldown > 0 || isResending;
  const resendLabel = cooldown > 0 ? t('auth.verifyEmail.resendCooldown', { seconds: cooldown }) : t('auth.verifyEmail.resend');

  return (
    <AuthShell
      hero="compact"
      title={t('auth.verifyEmail.title')}
      subtitle={t('auth.v2.verify.subtitle', { email })}
      footer={
        <View style={styles.links}>
          <TextButton label={t('auth.verifyEmail.changeEmail')} onPress={onChangeEmail} tone="muted" />
          <TextButton label={t('auth.verifyEmail.backToSignIn')} onPress={onBackToSignIn} tone="muted" />
        </View>
      }
    >
      <View style={styles.code}>
        <OtpCodeInput value={code} onChangeText={setCode} error={!!shownError} autoFocus />
      </View>
      <FormMessage tone="error" message={shownError} />
      {resendConfirmed && !shownError ? <FormMessage tone="success" message={t('auth.verifyEmail.resendConfirmed')} /> : null}
      <Button label={t('auth.verifyEmail.submit')} size="lg" block onPress={handleSubmit} loading={isSubmitting} />
      <AnimatedPressable
        style={styles.resend}
        onPress={handleResend}
        disabled={resendDisabled}
        haptic={resendDisabled ? false : 'light'}
        accessibilityRole="button"
        accessibilityLabel={resendLabel}
        accessibilityState={{ disabled: resendDisabled, busy: isResending }}
      >
        <Text style={[styles.resendText, resendDisabled && styles.resendTextDisabled]}>{resendLabel}</Text>
      </AnimatedPressable>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  code: { alignSelf: 'stretch', maxWidth: 380, width: '100%', marginTop: spacing.xs },
  resend: { alignSelf: 'center', minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: cardRadii.chip, backgroundColor: colors.surfaceMuted },
  resendText: { ...textStyles.caption, fontWeight: '700', color: colors.primary },
  resendTextDisabled: { color: colors.textMuted },
  links: { alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm },
});
