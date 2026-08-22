import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { VerifyResetCodeScreen } from '@/features/auth/VerifyResetCodeScreen';
import { authService, AuthError } from '@/services/auth';

export default function VerifyResetCodeRoute() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <VerifyResetCodeScreen
      email={email}
      isSubmitting={isSubmitting}
      error={error}
      onSubmit={async (code) => {
        setIsSubmitting(true);
        setError(null);
        try {
          await authService.verifyPasswordResetCode(email, code);
          router.push('/reset-password');
        } catch (err) {
          setError(err instanceof AuthError ? err.message : 'Белгисиз ката кетти.');
        } finally {
          setIsSubmitting(false);
        }
      }}
    />
  );
}
