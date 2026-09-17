import { router } from 'expo-router';

import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';
import { useAppStore } from '@/store/useAppStore';
import { useAuthStore } from '@/store/useAuthStore';

export default function OnboardingRoute() {
  const completeOnboarding = useAppStore((state) => state.completeOnboarding);

  return (
    <OnboardingScreen
      onFinish={async () => {
        await completeOnboarding();
        router.replace('/age-group' as never);
      }}
      onContinueAsGuest={async () => {
        await completeOnboarding();
        await useAuthStore.getState().continueAsGuest();
        router.replace('/age-group' as never);
      }}
    />
  );
}
