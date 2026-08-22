import { router } from 'expo-router';
import { useState } from 'react';

import { ForgotPasswordScreen } from '@/features/auth/ForgotPasswordScreen';
import { authService, AuthError } from '@/services/auth';

export default function ForgotPasswordRoute() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <ForgotPasswordScreen
      isSubmitting={isSubmitting}
      serverError={error}
      onSubmit={async (email) => {
        setIsSubmitting(true);
        setError(null);
        try {
          await authService.requestPasswordReset(email);
          router.push({ pathname: '/reset-password-sent', params: { email } } as never);
        } catch (err) {
          setError(err instanceof AuthError ? err.message : 'Белгисиз ката кетти.');
        } finally {
          setIsSubmitting(false);
        }
      }}
    />
  );
}
