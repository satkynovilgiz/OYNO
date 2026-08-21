import { router } from 'expo-router';
import { useEffect } from 'react';

import { NotificationsScreen } from '@/features/notifications/NotificationsScreen';
import { useNotificationsStore } from '@/store/useNotificationsStore';

export default function NotificationsRoute() {
  const readIds = useNotificationsStore((state) => state.readIds);
  const isLoaded = useNotificationsStore((state) => state.isLoaded);
  const load = useNotificationsStore((state) => state.load);
  const markAsRead = useNotificationsStore((state) => state.markAsRead);
  const markAllAsRead = useNotificationsStore((state) => state.markAllAsRead);

  useEffect(() => {
    if (!isLoaded) void load();
  }, [isLoaded, load]);

  return (
    <NotificationsScreen
      readIds={readIds}
      onPressBack={() => router.back()}
      onPressNotification={(notification) => markAsRead(notification.id)}
      onMarkAllAsRead={markAllAsRead}
    />
  );
}
