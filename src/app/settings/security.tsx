import { router } from 'expo-router';

import { SecurityScreen } from '@/features/settings/SecurityScreen';
import { useAuthStore } from '@/store/useAuthStore';

export default function SecurityRoute() {
  const isSubmitting = useAuthStore((state) => state.isSubmitting);
  const error = useAuthStore((state) => state.error);
  const changePassword = useAuthStore((state) => state.changePassword);
  const signOut = useAuthStore((state) => state.signOut);

  return (
    <SecurityScreen
      isSubmitting={isSubmitting}
      error={error}
      onChangePassword={changePassword}
      onSignOutAllSessions={async () => {
        await signOut();
        router.replace('/sign-in');
      }}
      onPressBack={() => router.back()}
    />
  );
}
