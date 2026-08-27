import { router } from 'expo-router';

import { AdminPushScreen } from '@/features/admin/AdminPushScreen';

export default function AdminPushRoute() {
  return <AdminPushScreen onPressBack={() => router.back()} />;
}
