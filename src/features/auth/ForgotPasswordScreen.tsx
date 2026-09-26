import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, TextField } from '@/components/ui';

import { AuthShell, FormMessage } from './AuthShell';
import { EMAIL_PLACEHOLDER, emailError, normalizeEmail } from './authValidation';

type ForgotPasswordScreenProps = {
  onSubmit: (email: string) => Promise<void>;
  isSubmitting: boolean;
  serverError: string | null;
  onPressBack?: () => void;
  large?: boolean;
};

/** Step 1 of reset: the account email -> an 8-digit code is emailed. The
 * next screen only opens after the request really succeeded. */
export function ForgotPasswordScreen({ onSubmit, isSubmitting, serverError, onPressBack, large = false }: ForgotPasswordScreenProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (isSubmitting) return;
    const key = emailError(email);
    setError(key);
    if (key) return;
    await onSubmit(normalizeEmail(email));
  };

  return (
    <AuthShell hero="compact" title={t('auth.v2.forgot.title')} subtitle={t('auth.v2.forgot.subtitle')} onPressBack={onPressBack}>
      <TextField
        label={t('auth.emailLabel')}
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          if (error) setError(null);
        }}
        error={error ? t(error) : null}
        placeholder={EMAIL_PLACEHOLDER}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="username"
        returnKeyType="send"
        onSubmitEditing={handleSubmit}
        autoFocus
        large={large}
      />
      <FormMessage tone="error" message={serverError} />
      <Button label={t('auth.v2.forgot.submit')} size="lg" block onPress={handleSubmit} loading={isSubmitting} />
    </AuthShell>
  );
}
