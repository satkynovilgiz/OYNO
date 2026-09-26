import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/services/supabase/client';

import { localizeCultureItem } from './localizedContent';
import { useLocalizer } from './translationsService';
import type { CultureItemRow } from './types';

export async function fetchCultureItems(categoryId: string): Promise<CultureItemRow[]> {
  const { data, error } = await supabase
    .from('culture_items')
    .select('*')
    .eq('category_id', categoryId)
    .order('sort_order');
  if (error) throw error;
  return data;
}

export async function fetchCultureItem(id: string): Promise<CultureItemRow | null> {
  const { data, error } = await supabase.from('culture_items').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchAllCultureItems(): Promise<CultureItemRow[]> {
  const { data, error } = await supabase.from('culture_items').select('*').order('sort_order');
  if (error) throw error;
  return data;
}

// Every hook below returns rows already localized for the app language
// (react-query `select`, so the cached raw Kyrgyz rows are untouched and
// every screen - Culture, Daily, Search, Saved, Offline - shows the same
// title for the same item).
export function useCultureItems(categoryId: string) {
  const { many } = useLocalizer(localizeCultureItem);
  return useQuery({
    queryKey: ['culture_items', categoryId],
    queryFn: () => fetchCultureItems(categoryId),
    select: many,
  });
}

/** Every culture item across every category, in one query - for Search and
 * Favorites, which need to resolve/index items without going category by
 * category the way CultureCategoryDetailScreen does. Same table/row shape
 * as `useCultureItems`, just without the `category_id` filter - not a new
 * data source. */
export function useAllCultureItems() {
  const { many } = useLocalizer(localizeCultureItem);
  return useQuery({ queryKey: ['culture_items', 'all'], queryFn: fetchAllCultureItems, select: many });
}

export function useCultureItem(id: string) {
  const { maybe } = useLocalizer(localizeCultureItem);
  return useQuery({
    queryKey: ['culture_item', id],
    queryFn: () => fetchCultureItem(id),
    enabled: !!id,
    select: maybe,
  });
}
