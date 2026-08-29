import { Redirect, router } from 'expo-router';

import { AccountSettingsScreen } from '@/features/settings/AccountSettingsScreen';
import { useAuthStore } from '@/store/useAuthStore';

export default function AccountSettingsRoute() {
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const isSubmitting = useAuthStore((state) => state.isSubmitting);
  const error = useAuthStore((state) => state.error);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const deleteAccount = useAuthStore((state) => state.deleteAccount);

  // Found live while testing a cold deep-link straight to this route:
  // on first render after a fresh page load, `user` is still null while
  // the real session is being restored (status === 'loading') - treating
  // that the same as "not logged in" fired a premature redirect to
  // /sign-up, which then bounced again once the real (authenticated)
  // status arrived a moment later. Waiting for status to leave 'loading'
  // avoids deciding on incomplete information. Guests are also redirected
  // before reaching this route (see settings/index), but this stays a
  // defensive guard rather than trusting that. <Redirect>, not an
  // imperative router.replace() (in render or an effect), because
  // expo-router's navigator isn't always ready for an imperative call on
  // a route's very first render/effect - <Redirect> is expo-router's own
  // mechanism for this and defers correctly.
  if (status === 'loading') return null;
  if (!user) return <Redirect href={'/sign-up' as never} />;

  return (
    <AccountSettingsScreen
      user={user}
      isSubmitting={isSubmitting}
      error={error}
      onPressBack={() => router.back()}
      onSaveProfile={updateProfile}
      onPressChangePassword={() => router.push('/settings/security' as never)}
      onDeleteAccount={deleteAccount}
      onPressCustomizeAvatar={() => router.push('/avatar-editor' as never)}
      onPressStoryCompanion={() => router.push('/character-select' as never)}
    />
  );
}
