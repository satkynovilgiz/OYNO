import { router } from 'expo-router';

import { AdminGate } from '@/features/admin/AdminGate';
import { AdminPushScreen } from '@/features/admin/AdminPushScreen';

export default function AdminPushRoute() {
  return (
    <AdminGate>
      <AdminPushScreen onPressBack={() => router.back()} />
    </AdminGate>
  );
}
