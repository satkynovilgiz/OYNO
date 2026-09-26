import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, TextButton, TextField } from '@/components/ui';
import type { OAuthProvider } from '@/services/auth';
import { colors, spacing, textStyles } from '@/theme';

import { AuthDivider, AuthShell, FormMessage } from './AuthShell';
import { EMAIL_PLACEHOLDER, normalizeEmail, validateSignIn, type FieldErrors } from './authValidation';

type SignInScreenProps = {
  onSubmit: (input: { email: string; password: string }) => Promise<boolean>;
  isSubmitting: boolean;
  serverError: string | null;
  onPressSignUp: () => void;
  onPressForgotPassword: () => void;
  /** Only the providers really enabled for this project. */
  oauthProviders: OAuthProvider[];
  onPressOAuth: (provider: OAuthProvider) => Promise<void>;
  /** Shown when this person is exploring as a guest (upgrading). */
  isGuest: boolean;
  /** Absent when guest mode isn't offered here (already a guest). */
  onContinueAsGuest?: () => void;
  onPressBack?: () => void;
  large?: boolean;
};

/**
 * Sign in: brand photo, one line on what an account adds, email +
 * password (AutoFill-ready), Forgot password, the error right above the
 * action, Sign in; social sign-in only for providers that exist; then
 * Create account and - first-class, not hidden - Continue without account.
 */
export function SignInScreen({
  onSubmit,
  isSubmitting,
  serverError,
  onPressSignUp,
  onPressForgotPassword,
  oauthProviders,
  onPressOAuth,
  isGuest,
  onContinueAsGuest,
  onPressBack,
  large = false,
}: SignInScreenProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors<'email' | 'password'>>({});
  const passwordRef = useRef<TextInput>(null);

  const handleSubmit = async () => {
    if (isSubmitting) return;
    const next = validateSignIn({ email, password });
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    await onSubmit({ email: normalizeEmail(email), password });
  };

  return (
    <AuthShell
      title={t('auth.v2.signIn.title')}
      subtitle={t('auth.v2.signIn.subtitle')}
      onPressBack={onPressBack}
      footer={
        <>
          <View style={styles.switchRow}>
            <Text style={styles.switchText}>{t('auth.v2.signIn.newHere')}</Text>
            <TextButton label={t('auth.v2.signIn.createAccount')} onPress={onPressSignUp} />
          </View>
          {onContinueAsGuest ? (
            <View style={styles.guest}>
              <Button label={t('auth.v2.guest.continue')} variant="ghost" block onPress={onContinueAsGuest} disabled={isSubmitting} />
              <Text style={styles.guestNote}>{t('auth.v2.guest.note')}</Text>
            </View>
          ) : null}
        </>
      }
    >
      {isGuest ? <FormMessage tone="info" message={t('auth.v2.guest.mergeNote')} /> : null}

      <TextField
        label={t('auth.emailLabel')}
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          if (errors.email) setErrors((current) => ({ ...current, email: undefined }));
        }}
        error={errors.email ? t(errors.email) : null}
        placeholder={EMAIL_PLACEHOLDER}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="username"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => passwordRef.current?.focus()}
        large={large}
      />
      <View style={styles.passwordBlock}>
        <TextField
          inputRef={passwordRef}
          label={t('auth.signIn.passwordLabel')}
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            if (errors.password) setErrors((current) => ({ ...current, password: undefined }));
          }}
          error={errors.password ? t(errors.password) : null}
          secure
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={handleSubmit}
          large={large}
        />
        <TextButton label={t('auth.v2.signIn.forgot')} onPress={onPressForgotPassword} style={styles.forgot} />
      </View>

      <FormMessage tone="error" message={serverError} />
      <Button label={t('auth.signIn.submit')} size="lg" block onPress={handleSubmit} loading={isSubmitting} />

      {oauthProviders.length > 0 ? (
        <>
          <AuthDivider label={t('auth.signIn.or')} />
          {oauthProviders.map((provider) => (
            <Button
              key={provider}
              label={t(provider === 'apple' ? 'auth.signIn.continueWithApple' : 'auth.signIn.continueWithGoogle')}
              variant="secondary"
              block
              onPress={() => void onPressOAuth(provider)}
              disabled={isSubmitting}
            />
          ))}
        </>
      ) : null}
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  passwordBlock: { gap: spacing.xs },
  forgot: { alignSelf: 'flex-end' },
  switchRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: spacing.xxs },
  switchText: { ...textStyles.caption, color: colors.textSecondary },
  guest: { alignSelf: 'stretch', gap: spacing.xs, alignItems: 'center' },
  guestNote: { ...textStyles.small, color: colors.textMuted, textAlign: 'center' },
});
