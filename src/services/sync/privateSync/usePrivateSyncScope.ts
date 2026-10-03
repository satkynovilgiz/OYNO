import { useRecordsOwner } from '@/features/games/records/useGameRecords';

import { usePrivateSyncStatus } from './privateSync';

/**
 * 'account' only once THIS account's private data has actually synced on
 * this device (a real completed sync) - otherwise screens keep the honest
 * "saved on this device" wording.
 */
export function usePrivateSyncScope(): 'account' | 'device' {
  const owner = useRecordsOwner();
  const synced = usePrivateSyncStatus((state) => !!state.syncedOwners[owner]);
  return owner !== 'guest' && synced ? 'account' : 'device';
}
