import { router } from 'expo-router';

import { AgeGroupScreen } from '@/features/ageGroup/AgeGroupScreen';
import { useAppStore } from '@/store/useAppStore';
import { useAuthStore } from '@/store/useAuthStore';

/** Sits between onboarding and the sign-up/home split (spec "Add age-group
 * selection to OYNO onboarding") - decides the final destination itself
 * (guest sessions already created by onContinueAsGuest go straight to
 * /home, everyone else continues to /sign-up) so routeGuard only has to
 * know "has this been chosen", not the sign-up/sign-in distinction. */
export default function AgeGroupRoute() {
  const setAgeGroup = useAppStore((state) => state.setAgeGroup);

  return (
    <AgeGroupScreen
      initialSelected={useAppStore.getState().ageGroup}
      onContinue={async (ageGroup) => {
        await setAgeGroup(ageGroup);
        const authStatus = useAuthStore.getState().status;
        router.replace((authStatus === 'guest' ? '/home' : '/sign-up') as never);
      }}
    />
  );
}
