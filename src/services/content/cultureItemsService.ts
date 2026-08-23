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

export function useCultureItems(categoryId: string) {
  return useQuery({
    queryKey: ['culture_items', categoryId],
    queryFn: () => fetchCultureItems(categoryId),
  });
}

export function useCultureItem(id: string) {
  return useQuery({
    queryKey: ['culture_item', id],
    queryFn: () => fetchCultureItem(id),
  });
}
