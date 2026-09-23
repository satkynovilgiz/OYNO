import { router } from 'expo-router';

import { SettingsScreen } from '@/features/settings/SettingsScreen';
import { useAuthStore } from '@/store/useAuthStore';

const ACCOUNT_ONLY_SECTIONS = new Set(['account', 'security']);

export default function SettingsRoute() {
  const status = useAuthStore((state) => state.status);
  const signOut = useAuthStore((state) => state.signOut);

  return (
    <SettingsScreen
      onPressBack={() => router.back()}
      onNavigate={(section) => {
        if (status === 'guest' && ACCOUNT_ONLY_SECTIONS.has(section)) {
          router.push('/sign-up' as never);
          return;
        }
        // Appearance is its own top-level area (/appearance), not a settings sub-page.
        router.push((section === 'appearance' ? '/appearance' : `/settings/${section}`) as never);
      }}
      onPressAdmin={() => router.push('/admin' as never)}
      onSignOut={signOut}
    />
  );
}
