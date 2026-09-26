import { router } from 'expo-router';
import { useState } from 'react';

import { ResetPasswordScreen } from '@/features/auth/ResetPasswordScreen';
import { authService, AuthError } from '@/services/auth';
import { localizeAuthError } from '@/services/auth/authErrors';
import { isOfflineNow } from '@/services/offline/networkStatus';

export default function ResetPasswordRoute() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);

  return (
    <ResetPasswordScreen
      isSubmitting={isSubmitting}
      serverError={error}
      expired={expired}
      onSubmit={async (newPassword) => {
        if (isOfflineNow()) {
          setError(localizeAuthError(new AuthError('network-error', ''), 'reset'));
          return false;
        }
        setIsSubmitting(true);
        setError(null);
        try {
          await authService.confirmPasswordReset(newPassword);
          return true;
        } catch (err) {
          // The short-lived reset session ran out (or was never there, e.g.
          // this screen opened directly): offer a new code instead of a
          // form that can never succeed.
          if (err instanceof AuthError && err.code === 'invalid-code') setExpired(true);
          else setError(localizeAuthError(err, 'reset'));
          return false;
        } finally {
          setIsSubmitting(false);
        }
      }}
      onRequestNewCode={() => router.replace('/forgot-password')}
      onPressSignIn={() => router.replace('/sign-in')}
    />
  );
}
