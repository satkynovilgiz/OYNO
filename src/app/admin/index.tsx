import { router } from 'expo-router';

import { AdminHomeScreen } from '@/features/admin/AdminHomeScreen';

export default function AdminRoute() {
  return (
    <AdminHomeScreen
      onPressBack={() => router.back()}
      onPressSection={(sectionId) => router.push(`/admin/${sectionId}` as never)}
      onPressPush={() => router.push('/admin/push' as never)}
    />
  );
}
