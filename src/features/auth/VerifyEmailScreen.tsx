import { MailCheck } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button, IconChip, OtpCodeInput, TextButton } from '@/components/ui';
import { colors, radii, spacing, typography } from '@/theme';

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

export function VerifyEmailScreen({ email, isSubmitting, error, onSubmit, onResend, onChangeEmail, onBackToSignIn }: VerifyEmailScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
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
    if (code.length !== 8) {
      setLocalError(t('auth.verifyEmail.codeError'));
      return;
    }
    setLocalError(null);
    onSubmit(code);
  };

  // Auto-submit once all 8 digits are entered - the manual "Verify" button
  // stays as a fallback (e.g. to retry after a failed attempt without
  // retyping, since a wrong code leaves `code` unchanged).
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

  return (
    <KeyboardAvoidingView
      style={styles.avoider}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top}
    >
      <ScrollView
        contentContainerStyle={[
          styles.root,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <IconChip icon={MailCheck} size={64} iconSize={30} color={colors.primary} />

          <View style={styles.textBlock}>
            <Text style={styles.title}>{t('auth.verifyEmail.title')}</Text>
            <Text style={styles.description}>
              {t('auth.verifyEmail.descriptionPrefix')}
              <Text style={styles.emailText}>{email}</Text>
              {t('auth.verifyEmail.descriptionSuffix')}
            </Text>
          </View>

          <View style={styles.codeBlock}>
            <OtpCodeInput value={code} onChangeText={setCode} error={!!shownError} autoFocus />
            {shownError ? <Text style={styles.errorText}>{shownError}</Text> : null}
          </View>

          <View style={styles.resendBlock}>
            {resendConfirmed && !shownError ? (
              <Text style={styles.confirmedText}>{t('auth.verifyEmail.resendConfirmed')}</Text>
            ) : null}
            <AnimatedPressable
              style={styles.resendPill}
              onPress={handleResend}
              disabled={cooldown > 0 || isResending}
              haptic={cooldown > 0 || isResending ? false : 'light'}
              accessibilityRole="button"
              accessibilityLabel={cooldown > 0 ? t('auth.verifyEmail.resendCooldown', { seconds: cooldown }) : t('auth.verifyEmail.resend')}
              accessibilityState={{ disabled: cooldown > 0 || isResending }}
            >
              <Text style={[styles.resendLink, (cooldown > 0 || isResending) && styles.resendLinkDisabled]}>
                {cooldown > 0 ? t('auth.verifyEmail.resendCooldown', { seconds: cooldown }) : t('auth.verifyEmail.resend')}
              </Text>
            </AnimatedPressable>
          </View>
        </View>

        <View style={styles.footer}>
          <Button label={t('auth.verifyEmail.submit')} onPress={handleSubmit} loading={isSubmitting} />
          <View style={styles.linksRow}>
            <TextButton label={t('auth.verifyEmail.changeEmail')} onPress={onChangeEmail} tone="muted" />
            <TextButton label={t('auth.verifyEmail.backToSignIn')} onPress={onBackToSignIn} tone="muted" />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  avoider: {
    flex: 1,
    backgroundColor: colors.background,
  },
  root: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
  },
  content: {
    alignItems: 'center',
    gap: spacing.lg,
  },
  textBlock: {
    alignItems: 'center',
    gap: spacing.xxs,
  },
  title: {
    ...typography.display,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emailText: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  codeBlock: {
    width: '100%',
    maxWidth: 360,
    gap: spacing.xs,
  },
  errorText: {
    ...typography.small,
    color: colors.danger,
    textAlign: 'center',
  },
  resendBlock: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  confirmedText: {
    ...typography.small,
    color: colors.primary,
  },
  resendPill: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    overflow: 'hidden',
  },
  resendLink: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  resendLinkDisabled: {
    color: colors.textMuted,
  },
  footer: {
    gap: spacing.md,
  },
  linksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
