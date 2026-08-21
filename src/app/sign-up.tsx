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
        const ok = await signUp(input);
        if (ok) router.replace('/profile-setup');
        return ok;
      }}
      onPressSignIn={() => {
        clearError();
        router.push('/sign-in');
      }}
    />
  );
}
