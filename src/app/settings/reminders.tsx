import { router } from 'expo-router';

import { ReminderSettingsScreen } from '@/features/settings/ReminderSettingsScreen';

export default function ReminderSettingsRoute() {
  return <ReminderSettingsScreen onPressBack={() => router.back()} />;
}
