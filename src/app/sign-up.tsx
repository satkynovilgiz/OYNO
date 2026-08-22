import { router } from 'expo-router';

import { SignUpScreen } from '@/features/auth/SignUpScreen';
import { useAuthStore } from '@/store/useAuthStore';

export default function SignUpRoute() {
  const signUp = useAuthStore((state) => state.signUp);
  const isSubmitting = useAuthStore((state) => state.isSubmitting);
  const error = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);

  return (
    <SignUpScreen
      isSubmitting={isSubmitting}
      serverError={error}
      onSubmit={async (input) => {
        const result = await signUp(input);
        if (!result) return false;
        if (result.status === 'verification-required') {
          router.replace({ pathname: '/verify-email', params: { email: result.email } } as never);
        } else {
          router.replace('/profile-setup');
        }
        return true;
      }}
      onPressSignIn={() => {
        clearError();
        router.push('/sign-in');
      }}
    />
  );
}
