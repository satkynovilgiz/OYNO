import { router } from 'expo-router';
import { useEffect } from 'react';

import { SignUpScreen } from '@/features/auth/SignUpScreen';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import type { OAuthProvider } from '@/services/auth';
import { useEnabledOAuthProviders } from '@/services/auth/authProviders';
import { useAuthStore } from '@/store/useAuthStore';

export default function SignUpRoute() {
  const signUp = useAuthStore((state) => state.signUp);
  const signInWithOAuth = useAuthStore((state) => state.signInWithOAuth);
  const status = useAuthStore((state) => state.status);
  const isSubmitting = useAuthStore((state) => state.isSubmitting);
  const error = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);
  const providers = useEnabledOAuthProviders();
  const { experience } = useAgeExperience();

  useEffect(() => clearError(), [clearError]);

  const handleOAuth = async (provider: OAuthProvider) => {
    const outcome = await signInWithOAuth(provider);
    if (outcome === 'new-user') router.replace('/profile-setup');
    else if (outcome === 'signed-in') router.replace('/home');
  };

  return (
    <SignUpScreen
      isSubmitting={isSubmitting}
      serverError={error}
      isGuest={status === 'guest'}
      large={experience === 'child'}
      oauthProviders={providers}
      onPressOAuth={handleOAuth}
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
        router.replace('/sign-in');
      }}
      onPressBack={router.canGoBack() ? () => router.back() : undefined}
    />
  );
}
