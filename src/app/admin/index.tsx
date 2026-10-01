import { router } from 'expo-router';

import { AdminGate } from '@/features/admin/AdminGate';
import { AdminHomeScreen } from '@/features/admin/AdminHomeScreen';

export default function AdminRoute() {
  return (
    <AdminGate>
      <AdminHomeScreen
        onPressBack={() => router.back()}
        onPressSection={(sectionId) => router.push(`/admin/${sectionId}` as never)}
        onPressPush={() => router.push('/admin/push' as never)}
        onPressFeedback={() => router.push('/admin/feedback' as never)}
        onPressRegions={() => router.push('/admin/regions' as never)}
      />
    </AdminGate>
  );
}
