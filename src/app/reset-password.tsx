import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ResetPasswordScreen } from '@/features/auth/ResetPasswordScreen';
import { authService, AuthError } from '@/services/auth';

export default function ResetPasswordRoute() {
  const { t } = useTranslation();
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
          await authService.confirmPasswordReset(newPassword);
          return true;
        } catch (err) {
          setError(err instanceof AuthError ? err.message : t('common.unknownError'));
          return false;
        } finally {
          setIsSubmitting(false);
        }
      }}
      onPressSignIn={() => router.replace('/sign-in')}
    />
  );
}
