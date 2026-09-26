import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/services/supabase/client';

import { localizeQuest, localizeRegion } from './localizedContent';
import { useLocalizer } from './translationsService';
import type { ExploreRegionRow, QuestRow } from './types';

export async function fetchExploreRegions(): Promise<ExploreRegionRow[]> {
  const { data, error } = await supabase.from('explore_regions').select('*').order('sort_order');
  if (error) throw error;
  return data;
}

export async function fetchExploreRegion(id: string): Promise<ExploreRegionRow | null> {
  const { data, error } = await supabase.from('explore_regions').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchCurrentQuest(): Promise<QuestRow | null> {
  const { data, error } = await supabase.from('quests').select('*').limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

// Facts and quest text come back localized (localizedContent.ts); names
// are already per-language columns.
export function useExploreRegions() {
  const { many } = useLocalizer(localizeRegion);
  return useQuery({ queryKey: ['explore_regions'], queryFn: fetchExploreRegions, select: many });
}

export function useExploreRegion(id: string | undefined) {
  const { maybe } = useLocalizer(localizeRegion);
  return useQuery({
    queryKey: ['explore_regions', id],
    queryFn: () => fetchExploreRegion(id as string),
    enabled: !!id,
    select: maybe,
  });
}

export function useCurrentQuest() {
  const { maybe } = useLocalizer(localizeQuest);
  return useQuery({ queryKey: ['quests', 'current'], queryFn: fetchCurrentQuest, select: maybe });
}
