import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { ResetPasswordScreen } from '@/features/auth/ResetPasswordScreen';
import { authService, AuthError } from '@/services/auth';

export default function ResetPasswordRoute() {
  const { email, code } = useLocalSearchParams<{ email: string; code: string }>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <ResetPasswordScreen
      isSubmitting={isSubmitting}
      serverError={error}
      onSubmit={async (newPassword) => {
        setIsSubmitting(true);
        setError(null);
        try {
          await authService.confirmPasswordReset(email, code, newPassword);
          return true;
        } catch (err) {
          setError(err instanceof AuthError ? err.message : 'Белгисиз ката кетти.');
          return false;
        } finally {
          setIsSubmitting(false);
        }
      }}
      onPressSignIn={() => router.replace('/sign-in')}
    />
  );
}
