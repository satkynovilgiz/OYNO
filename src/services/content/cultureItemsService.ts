import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/services/supabase/client';

import type { CultureItemRow } from './types';

async function fetchCultureItems(categoryId: string): Promise<CultureItemRow[]> {
  const { data, error } = await supabase
    .from('culture_items')
    .select('*')
    .eq('category_id', categoryId)
    .order('sort_order');
  if (error) throw error;
  return data;
}

async function fetchCultureItem(id: string): Promise<CultureItemRow | null> {
  const { data, error } = await supabase.from('culture_items').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

async function fetchAllCultureItems(): Promise<CultureItemRow[]> {
  const { data, error } = await supabase.from('culture_items').select('*').order('sort_order');
  if (error) throw error;
  return data;
}

export function useCultureItems(categoryId: string) {
  return useQuery({
    queryKey: ['culture_items', categoryId],
    queryFn: () => fetchCultureItems(categoryId),
  });
}

/** Every culture item across every category, in one query - for Search and
 * Favorites, which need to resolve/index items without going category by
 * category the way CultureCategoryDetailScreen does. Same table/row shape
 * as `useCultureItems`, just without the `category_id` filter - not a new
 * data source. */
export function useAllCultureItems() {
  return useQuery({ queryKey: ['culture_items', 'all'], queryFn: fetchAllCultureItems });
}

export function useCultureItem(id: string) {
  return useQuery({
    queryKey: ['culture_item', id],
    queryFn: () => fetchCultureItem(id),
    enabled: !!id,
  });
}
