import { router } from 'expo-router';

import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';
import { useAppStore } from '@/store/useAppStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useFirstUseStore } from '@/store/useFirstUseStore';

export default function OnboardingRoute() {
  const completeOnboarding = useAppStore((state) => state.completeOnboarding);

  return (
    <OnboardingScreen
      onFinish={async () => {
        await completeOnboarding();
        void useFirstUseStore.getState().offer('guest');
        router.replace('/age-group' as never);
      }}
      onContinueAsGuest={async () => {
        await completeOnboarding();
        await useAuthStore.getState().continueAsGuest();
        void useFirstUseStore.getState().offer('guest');
        router.replace('/age-group' as never);
      }}
    />
  );
}
