import { router } from 'expo-router';

import { PrivacySettingsScreen } from '@/features/settings/PrivacySettingsScreen';

export default function PrivacySettingsRoute() {
  return <PrivacySettingsScreen onPressBack={() => router.back()} />;
}
