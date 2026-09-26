import { router } from 'expo-router';
import { useEffect } from 'react';

import { SignInScreen } from '@/features/auth/SignInScreen';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { useEnabledOAuthProviders } from '@/services/auth/authProviders';
import type { OAuthProvider } from '@/services/auth';
import { useAuthStore } from '@/store/useAuthStore';

export default function SignInRoute() {
  const signIn = useAuthStore((state) => state.signIn);
  const signInWithOAuth = useAuthStore((state) => state.signInWithOAuth);
  const continueAsGuest = useAuthStore((state) => state.continueAsGuest);
  const status = useAuthStore((state) => state.status);
  const isSubmitting = useAuthStore((state) => state.isSubmitting);
  const error = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);
  const providers = useEnabledOAuthProviders();
  const { experience } = useAgeExperience();
  const isGuest = status === 'guest';

  // Never show an error left over from another screen (e.g. Settings).
  useEffect(() => clearError(), [clearError]);

  const handleOAuth = async (provider: OAuthProvider) => {
    const outcome = await signInWithOAuth(provider);
    if (outcome === 'new-user') router.replace('/profile-setup');
    else if (outcome === 'signed-in') router.replace('/home');
  };

  return (
    <SignInScreen
      isSubmitting={isSubmitting}
      serverError={error}
      isGuest={isGuest}
      large={experience === 'child'}
      oauthProviders={providers}
      onPressOAuth={handleOAuth}
      onSubmit={async (input) => {
        const ok = await signIn(input);
        // No success modal - straight into OYNO.
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
      // A guest who opened Sign in from Settings goes back; someone at the
      // sign-in gate can continue without an account instead.
      onPressBack={isGuest && router.canGoBack() ? () => router.back() : undefined}
      onContinueAsGuest={
        isGuest
          ? undefined
          : async () => {
              clearError();
              await continueAsGuest();
              router.replace('/home');
            }
      }
    />
  );
}
