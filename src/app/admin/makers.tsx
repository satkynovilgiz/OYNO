import { router } from 'expo-router';

import { AdminGate } from '@/features/admin/AdminGate';
import { MakersPreviewScreen } from '@/features/makers/MakersPreviewScreen';

export default function AdminMakersRoute() {
  return (
    <AdminGate>
      <MakersPreviewScreen onPressBack={() => router.back()} />
    </AdminGate>
  );
}
