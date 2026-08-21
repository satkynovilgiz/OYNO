import { router } from 'expo-router';

import { PrivacySettingsScreen } from '@/features/settings/PrivacySettingsScreen';
import { useSettingsStore } from '@/store/useSettingsStore';

export default function PrivacySettingsRoute() {
  const preferences = useSettingsStore((state) => state.privacy);
  const setPrivacyPreference = useSettingsStore((state) => state.setPrivacyPreference);

  return (
    <PrivacySettingsScreen preferences={preferences} onChange={setPrivacyPreference} onPressBack={() => router.back()} />
  );
}
