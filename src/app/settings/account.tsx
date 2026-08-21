import { router } from 'expo-router';

import { AccountSettingsScreen } from '@/features/settings/AccountSettingsScreen';
import { useAuthStore } from '@/store/useAuthStore';

export default function AccountSettingsRoute() {
  const user = useAuthStore((state) => state.user);
  const isSubmitting = useAuthStore((state) => state.isSubmitting);
  const error = useAuthStore((state) => state.error);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const deleteAccount = useAuthStore((state) => state.deleteAccount);

  if (!user) {
    // Guests are redirected before reaching this route (see settings/index),
    // but guard defensively rather than crashing on a null user.
    router.replace('/sign-up' as never);
    return null;
  }

  return (
    <AccountSettingsScreen
      user={user}
      isSubmitting={isSubmitting}
      error={error}
      onPressBack={() => router.back()}
      onSaveProfile={updateProfile}
      onPressChangePassword={() => router.push('/settings/security' as never)}
      onDeleteAccount={deleteAccount}
    />
  );
}
