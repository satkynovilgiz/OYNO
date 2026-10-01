import { router, useLocalSearchParams } from 'expo-router';

import { AdminGate } from '@/features/admin/AdminGate';
import { AdminRegionEditorScreen } from '@/features/admin/AdminRegionEditorScreen';

export default function AdminRegionEditorRoute() {
  const { regionId } = useLocalSearchParams<{ regionId: string }>();
  return (
    <AdminGate>
      <AdminRegionEditorScreen regionId={String(regionId ?? '')} onPressBack={() => router.back()} />
    </AdminGate>
  );
}
