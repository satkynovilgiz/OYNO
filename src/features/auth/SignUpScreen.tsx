import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, TextButton, TextField } from '@/components/ui';
import type { OAuthProvider } from '@/services/auth';
import { colors, spacing, textStyles } from '@/theme';

import { AuthDivider, AuthShell, FormMessage } from './AuthShell';
import { EMAIL_PLACEHOLDER, MIN_PASSWORD_LENGTH, normalizeEmail, validateSignUp, type FieldErrors } from './authValidation';

type SignUpScreenProps = {
  onSubmit: (input: { name: string; email: string; password: string }) => Promise<boolean>;
  isSubmitting: boolean;
  serverError: string | null;
  onPressSignIn: () => void;
  oauthProviders: OAuthProvider[];
  onPressOAuth: (provider: OAuthProvider) => Promise<void>;
  isGuest: boolean;
  onPressBack?: () => void;
  large?: boolean;
};

/**
 * Create account - only what the account really needs: a name (shown on
 * the profile), email and one password (with show/hide instead of a
 * "confirm password" field). The one rule shown is the backend's own:
 * at least 8 characters.
 */
export function SignUpScreen({ onSubmit, isSubmitting, serverError, onPressSignIn, oauthProviders, onPressOAuth, isGuest, onPressBack, large = false }: SignUpScreenProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors<'name' | 'email' | 'password'>>({});
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const clear = (field: 'name' | 'email' | 'password') => errors[field] && setErrors((current) => ({ ...current, [field]: undefined }));

  const handleSubmit = async () => {
    if (isSubmitting) return;
    const next = validateSignUp({ name, email, password });
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    await onSubmit({ name: name.trim(), email: normalizeEmail(email), password });
  };

  return (
    <AuthShell
      title={t('auth.v2.signUp.title')}
      subtitle={t('auth.v2.signUp.subtitle')}
      onPressBack={onPressBack}
      footer={
        <View style={styles.switchRow}>
          <Text style={styles.switchText}>{t('auth.signUp.hasAccount')}</Text>
          <TextButton label={t('auth.signUp.signInLink')} onPress={onPressSignIn} />
        </View>
      }
    >
      {isGuest ? <FormMessage tone="info" message={t('auth.v2.guest.mergeNote')} /> : null}

      <TextField
        label={t('auth.signUp.nameLabel')}
        value={name}
        onChangeText={(value) => {
          setName(value);
          clear('name');
        }}
        error={errors.name ? t(errors.name) : null}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => emailRef.current?.focus()}
        large={large}
      />
      <TextField
        inputRef={emailRef}
        label={t('auth.emailLabel')}
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          clear('email');
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
      <TextField
        inputRef={passwordRef}
        label={t('auth.signIn.passwordLabel')}
        value={password}
        onChangeText={(value) => {
          setPassword(value);
          clear('password');
        }}
        error={errors.password ? t(errors.password, { count: MIN_PASSWORD_LENGTH }) : null}
        hint={t('auth.v2.passwordRule', { count: MIN_PASSWORD_LENGTH })}
        secure
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={handleSubmit}
        large={large}
      />

      <FormMessage tone="error" message={serverError} />
      <Button label={t('auth.v2.signUp.submit')} size="lg" block onPress={handleSubmit} loading={isSubmitting} />

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
  switchRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: spacing.xxs },
  switchText: { ...textStyles.caption, color: colors.textSecondary },
});
