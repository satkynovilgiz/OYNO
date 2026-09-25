import { router } from 'expo-router';

import { SettingsScreen } from '@/features/settings/SettingsScreen';
import { useAuthStore } from '@/store/useAuthStore';

export default function SettingsRoute() {
  const signOut = useAuthStore((state) => state.signOut);
  return <SettingsScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/home'))} onSignOut={signOut} />;
}
