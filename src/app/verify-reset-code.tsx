import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { VerifyResetCodeScreen } from '@/features/auth/VerifyResetCodeScreen';
import { authService } from '@/services/auth';
import { localizeAuthError } from '@/services/auth/authErrors';

export default function VerifyResetCodeRoute() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const backToEmail = () => (router.canGoBack() ? router.back() : router.replace('/forgot-password'));

  return (
    <VerifyResetCodeScreen
      email={email ?? ''}
      isSubmitting={isSubmitting}
      error={error}
      onPressBack={backToEmail}
      onRequestNewCode={backToEmail}
      onSubmit={async (code) => {
        setIsSubmitting(true);
        setError(null);
        try {
          await authService.verifyPasswordResetCode(email, code);
          router.push('/reset-password');
        } catch (err) {
          setError(localizeAuthError(err, 'reset'));
        } finally {
          setIsSubmitting(false);
        }
      }}
    />
  );
}
