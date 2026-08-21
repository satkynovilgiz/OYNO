import { router } from 'expo-router';

import { SignInScreen } from '@/features/auth/SignInScreen';
import { useAuthStore } from '@/store/useAuthStore';

export default function SignInRoute() {
  const signIn = useAuthStore((state) => state.signIn);
  const isSubmitting = useAuthStore((state) => state.isSubmitting);
  const error = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);

  return (
    <SignInScreen
      isSubmitting={isSubmitting}
      serverError={error}
      onSubmit={async (input) => {
        const ok = await signIn(input);
        if (ok) router.replace('/home');
        return ok;
      }}
      onPressSignUp={() => {
        clearError();
        router.push('/sign-up');
      }}
      onPressForgotPassword={() => {
        clearError();
        router.push('/forgot-password');
      }}
    />
  );
}
