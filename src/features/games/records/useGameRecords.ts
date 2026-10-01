import { useEffect } from 'react';

import { ownerRecords, useGameRecordsStore, type OwnerRecords } from '@/store/useGameRecordsStore';
import { useAuthStore } from '@/store/useAuthStore';

import { makeSession, type GameSessionRecord, type RecordOutcome } from './gameRecords';

/** Whose records are on screen: the signed-in account, else the guest. */
export function currentRecordsOwner(): string {
  const { status, user } = useAuthStore.getState();
  return status === 'authenticated' && user?.id ? user.id : 'guest';
}

export function useRecordsOwner(): string {
  return useAuthStore((state) => (state.status === 'authenticated' && state.user?.id ? state.user.id : 'guest'));
}

/** The current person's records (re-selected the moment the account changes). */
export function useGameRecords(): { records: OwnerRecords; isLoaded: boolean } {
  const owner = useRecordsOwner();
  const saved = useGameRecordsStore((state) => state.saved);
  const isLoaded = useGameRecordsStore((state) => state.isLoaded);
  useEffect(() => {
    void useGameRecordsStore.getState().load();
  }, []);
  return { records: ownerRecords(saved, owner), isLoaded };
}

/**
 * Called once from a game's RESULT phase - the only place a round counts.
 * Waits for the stored records first so nothing older is overwritten.
 */
export async function recordGameSession(gameId: string, input: Omit<GameSessionRecord, 'id' | 'gameId' | 'completedAt'>): Promise<RecordOutcome> {
  await useGameRecordsStore.getState().load();
  return useGameRecordsStore.getState().record(currentRecordsOwner(), makeSession(gameId, input));
}
