import { router } from 'expo-router';

import { AdminGate } from '@/features/admin/AdminGate';
import { FIXTURE_ILLUSTRATION } from '@/features/culture/explorer/explorerModel';
import { ObjectExplorerScreen } from '@/features/culture/explorer/ObjectExplorer';

/** INTERNAL: the Object Explorer with its labelled schematic fixture (no reviewed illustration exists yet). */
export default function AdminExplorerRoute() {
  return (
    <AdminGate>
      <ObjectExplorerScreen illustration={FIXTURE_ILLUSTRATION} onPressBack={() => router.back()} />
    </AdminGate>
  );
}
