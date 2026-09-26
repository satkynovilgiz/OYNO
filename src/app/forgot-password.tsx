import { router } from 'expo-router';
import { useState } from 'react';

import { ForgotPasswordScreen } from '@/features/auth/ForgotPasswordScreen';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { authService, AuthError } from '@/services/auth';
import { localizeAuthError } from '@/services/auth/authErrors';
import { isOfflineNow } from '@/services/offline/networkStatus';

export default function ForgotPasswordRoute() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { experience } = useAgeExperience();

  return (
    <ForgotPasswordScreen
      isSubmitting={isSubmitting}
      serverError={error}
      large={experience === 'child'}
      onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/sign-in'))}
      onSubmit={async (email) => {
        if (isOfflineNow()) {
          setError(localizeAuthError(new AuthError('network-error', ''), 'reset'));
          return;
        }
        setIsSubmitting(true);
        setError(null);
        try {
          await authService.requestPasswordReset(email);
          // Only after the request really succeeded.
          router.push({ pathname: '/verify-reset-code', params: { email } } as never);
        } catch (err) {
          setError(localizeAuthError(err, 'reset'));
        } finally {
          setIsSubmitting(false);
        }
      }}
    />
  );
}
