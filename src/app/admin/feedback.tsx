import { router } from 'expo-router';

import { AdminFeedbackScreen } from '@/features/admin/AdminFeedbackScreen';
import { AdminGate } from '@/features/admin/AdminGate';

export default function AdminFeedbackRoute() {
  return (
    <AdminGate>
      <AdminFeedbackScreen onPressBack={() => router.back()} />
    </AdminGate>
  );
}
