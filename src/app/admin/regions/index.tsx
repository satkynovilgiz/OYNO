import { router } from 'expo-router';

import { AdminGate } from '@/features/admin/AdminGate';
import { AdminRegionsScreen } from '@/features/admin/AdminRegionsScreen';

export default function AdminRegionsRoute() {
  return (
    <AdminGate>
      <AdminRegionsScreen onPressBack={() => router.back()} onPressRegion={(id) => router.push(`/admin/regions/${id}` as never)} />
    </AdminGate>
  );
}
