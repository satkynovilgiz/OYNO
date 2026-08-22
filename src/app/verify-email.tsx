import { router, useLocalSearchParams } from 'expo-router';

import { VerifyEmailScreen } from '@/features/auth/VerifyEmailScreen';
import { useAuthStore } from '@/store/useAuthStore';

export default function VerifyEmailRoute() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const verifyEmail = useAuthStore((state) => state.verifyEmail);
  const resendVerificationEmail = useAuthStore((state) => state.resendVerificationEmail);
  const isSubmitting = useAuthStore((state) => state.isSubmitting);
  const error = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);

  return (
    <VerifyEmailScreen
      email={email}
      isSubmitting={isSubmitting}
      error={error}
      onSubmit={async (code) => {
        const ok = await verifyEmail(email, code);
        if (ok) router.replace('/profile-setup');
      }}
      onResend={() => resendVerificationEmail(email)}
      onChangeEmail={() => {
        clearError();
        router.replace('/sign-up');
      }}
      onBackToSignIn={() => {
        clearError();
        router.replace('/sign-in');
      }}
    />
  );
}
