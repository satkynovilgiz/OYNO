import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/services/supabase/client';

export type RegionLinkType = 'destination' | 'discovery' | 'culture_item' | 'culture_material' | 'trail' | 'quest';
export type RegionLinkRow = { region_id: string; content_type: RegionLinkType; content_id: string; sort_order: number; updated_at?: string };
export type RegionIntroRow = { region_id: string; language: 'kg' | 'ru' | 'en'; intro: string; updated_at?: string };

export const REGION_LINKS_KEY = ['region_content_links'] as const;
export const REGION_INTROS_KEY = ['region_intros'] as const;

/** Missing table (migration not applied yet) = no editorial rows; the app
 * then keeps its built-in region links. Never an error for the user. */
function missingTable(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === '42P01' || code === 'PGRST205';
}

export async function fetchRegionLinks(): Promise<RegionLinkRow[]> {
  // Explicit columns: editor bookkeeping (updated_by) is not readable.
  const { data, error } = await supabase.from('region_content_links').select('region_id, content_type, content_id, sort_order, updated_at').order('sort_order');
  if (error) {
    if (missingTable(error)) return [];
    throw error;
  }
  return (data ?? []) as RegionLinkRow[];
}

export async function fetchRegionIntros(): Promise<RegionIntroRow[]> {
  const { data, error } = await supabase.from('region_intros').select('region_id, language, intro, updated_at');
  if (error) {
    if (missingTable(error)) return [];
    throw error;
  }
  return (data ?? []) as RegionIntroRow[];
}

export function useRegionLinks() {
  return useQuery({ queryKey: REGION_LINKS_KEY, queryFn: fetchRegionLinks, staleTime: 10 * 60 * 1000 });
}

export function useRegionIntros() {
  return useQuery({ queryKey: REGION_INTROS_KEY, queryFn: fetchRegionIntros, staleTime: 10 * 60 * 1000 });
}
