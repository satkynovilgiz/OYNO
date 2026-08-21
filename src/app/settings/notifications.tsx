import { router } from 'expo-router';

import { NotificationSettingsScreen } from '@/features/settings/NotificationSettingsScreen';
import { useSettingsStore } from '@/store/useSettingsStore';

export default function NotificationSettingsRoute() {
  const preferences = useSettingsStore((state) => state.notifications);
  const setNotificationPreference = useSettingsStore((state) => state.setNotificationPreference);

  return (
    <NotificationSettingsScreen
      preferences={preferences}
      onChange={setNotificationPreference}
      onPressBack={() => router.back()}
    />
  );
}
