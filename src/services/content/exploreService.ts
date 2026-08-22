import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/services/supabase/client';

import type { ExploreRegionRow, QuestRow } from './types';

async function fetchExploreRegions(): Promise<ExploreRegionRow[]> {
  const { data, error } = await supabase.from('explore_regions').select('*').order('sort_order');
  if (error) throw error;
  return data;
}

async function fetchExploreRegion(id: string): Promise<ExploreRegionRow | null> {
  const { data, error } = await supabase.from('explore_regions').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

async function fetchCurrentQuest(): Promise<QuestRow | null> {
  const { data, error } = await supabase.from('quests').select('*').limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

export function useExploreRegions() {
  return useQuery({ queryKey: ['explore_regions'], queryFn: fetchExploreRegions });
}

export function useExploreRegion(id: string | undefined) {
  return useQuery({
    queryKey: ['explore_regions', id],
    queryFn: () => fetchExploreRegion(id as string),
    enabled: !!id,
  });
}

export function useCurrentQuest() {
  return useQuery({ queryKey: ['quests', 'current'], queryFn: fetchCurrentQuest });
}
