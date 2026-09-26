import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useCollectionSignals } from '@/features/collections/useCollectionProgress';
import { supabase } from '@/services/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { useChallengeStore } from '@/store/useChallengeStore';
import { useProgressStore } from '@/store/useProgressStore';

import { computeQuestProgress, type QuestProgress, type QuestSignals } from './questProgress';
import { GUIDED_QUESTS } from './questsData';

export const CLAIMED_QUESTS_KEY = ['guided_quests_claimed'] as const;

/** Real signals from the existing, account-scoped stores. */
export function useQuestSignals(): QuestSignals {
  const collectionSignals = useCollectionSignals();
  const visitedRegionIds = useProgressStore((state) => state.visitedRegionIds);
  const results = useChallengeStore((state) => state.results);
  const completedChallengeKeys = useMemo(() => Object.entries(results).filter(([, result]) => !!result?.completedAt).map(([key]) => key), [results]);
  return useMemo(() => ({ ...collectionSignals, visitedRegionIds, completedChallengeKeys }), [collectionSignals, visitedRegionIds, completedChallengeKeys]);
}

export function useQuestProgress(): QuestProgress[] {
  const signals = useQuestSignals();
  return useMemo(() => GUIDED_QUESTS.map((quest) => computeQuestProgress(quest, signals)), [signals]);
}

/** Quests whose reward this account already received (server truth).
 * User-scoped cache (cleared on account change - userScopedCache.ts). */
export function useClaimedQuestIds(): Set<string> {
  const signedIn = useAuthStore((state) => state.status === 'authenticated');
  const { data } = useQuery({
    queryKey: CLAIMED_QUESTS_KEY,
    enabled: signedIn,
    queryFn: async () => {
      const { data: rows, error } = await supabase.from('user_guided_quests').select('quest_id');
      if (error) throw error;
      return (rows ?? []).map((row) => row.quest_id as string);
    },
  });
  return useMemo(() => new Set(signedIn ? (data ?? []) : []), [data, signedIn]);
}
