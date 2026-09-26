import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/services/supabase/client';

import { localizeMaterial } from './localizedContent';
import { useLocalizer } from './translationsService';
import type { CultureCategoryRow, CultureMaterialRow } from './types';

export async function fetchCultureCategories(): Promise<CultureCategoryRow[]> {
  const { data, error } = await supabase.from('culture_categories').select('*').order('sort_order');
  if (error) throw error;
  return data;
}

export async function fetchCultureMaterials(): Promise<CultureMaterialRow[]> {
  const { data, error } = await supabase.from('culture_materials').select('*').order('sort_order');
  if (error) throw error;
  return data;
}

export async function fetchCultureMaterial(id: string): Promise<CultureMaterialRow | null> {
  const { data, error } = await supabase.from('culture_materials').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export function useCultureCategories() {
  return useQuery({ queryKey: ['culture_categories'], queryFn: fetchCultureCategories });
}

/** Materials come back localized for the app language (see
 * localizedContent.ts), with an honest Kyrgyz fallback. */
export function useCultureMaterials() {
  const { many } = useLocalizer(localizeMaterial);
  return useQuery({ queryKey: ['culture_materials'], queryFn: fetchCultureMaterials, select: many });
}

export function useCultureMaterial(id: string) {
  const { maybe } = useLocalizer(localizeMaterial);
  return useQuery({ queryKey: ['culture_material', id], queryFn: () => fetchCultureMaterial(id), select: maybe });
}
