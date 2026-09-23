import { router } from 'expo-router';

import { ReminderSettingsScreen } from '@/features/settings/ReminderSettingsScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function ReminderSettingsRoute() {
  return <ReminderSettingsScreen onPressBack={() => router.back()} />;
}
