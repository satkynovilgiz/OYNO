import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import { fetchOymoCreations } from '@/services/content/oymoCreationsService';
import { ownerCapsules, useCapsuleStore } from '@/store/useCapsuleStore';
import { ownerBoards, useDiscoveryBoardStore } from '@/store/useDiscoveryBoardStore';
import { ownerCollections, useMyCollectionsStore } from '@/store/useMyCollectionsStore';

import { boardItems, capsuleItems, designItems, exhibitionItems, type ShelfType, type SourceState } from './shelfModel';

/** Each source on its own: loading, ready, error (with retry) or not available - independently. */
export function useShelfSources(owner: string): Record<ShelfType, SourceState> {
  const signedIn = owner !== 'guest';
  // Saved designs live in the account (RLS: the signed-in user's rows). Keyed by OWNER, so another
  // account's cached list can never show here after a switch.
  const designs = useQuery({ queryKey: ['oymo_creations', 'shelf', owner], queryFn: fetchOymoCreations, enabled: signedIn });
  const collectionsLoaded = useMyCollectionsStore((state) => state.isLoaded);
  const collections = useMyCollectionsStore((state) => state.saved);
  const museums = useMyCollectionsStore((state) => state.museums);
  const boardStatus = useDiscoveryBoardStore((state) => state.status);
  const boards = useDiscoveryBoardStore((state) => state.saved);
  const capsuleStatus = useCapsuleStore((state) => state.status);
  const capsules = useCapsuleStore((state) => state.saved);
  useEffect(() => {
    void useMyCollectionsStore.getState().load();
    void useDiscoveryBoardStore.getState().load();
    void useCapsuleStore.getState().load();
  }, []);
  return useMemo(
    () => ({
      design: !signedIn
        ? { status: 'unavailable', reason: 'signedOut' }
        : !designs.data && designs.fetchStatus === 'paused'
          ? { status: 'unavailable', reason: 'offline' }
          : designs.isError
            ? { status: 'error', retry: () => void designs.refetch() }
            : designs.data
              ? { status: 'ready', items: designItems(designs.data) }
              : { status: 'loading' },
      exhibition: collectionsLoaded ? { status: 'ready', items: exhibitionItems(museums[owner], ownerCollections(collections, owner)) } : { status: 'loading' },
      board:
        boardStatus === 'error' ? { status: 'error', retry: () => void useDiscoveryBoardStore.getState().retryLoad() } : boardStatus === 'ready' ? { status: 'ready', items: boardItems(ownerBoards(boards, owner)) } : { status: 'loading' },
      capsule:
        capsuleStatus === 'error'
          ? {
              status: 'error',
              retry: () => {
                useCapsuleStore.setState({ status: 'idle' });
                void useCapsuleStore.getState().load();
              },
            }
          : capsuleStatus === 'ready'
            ? { status: 'ready', items: capsuleItems(ownerCapsules(capsules, owner)) }
            : { status: 'loading' },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signedIn, owner, designs.isError, designs.data, designs.fetchStatus, collectionsLoaded, collections, museums, boardStatus, boards, capsuleStatus, capsules],
  );
}
