import { router } from 'expo-router';

import { NotificationsScreen } from '@/features/notifications/NotificationsScreen';

export default function NotificationsRoute() {
  return <NotificationsScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/home'))} />;
}
