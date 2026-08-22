import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/services/supabase/client';

import type { CultureCategoryRow, CultureMaterialRow } from './types';

async function fetchCultureCategories(): Promise<CultureCategoryRow[]> {
  const { data, error } = await supabase.from('culture_categories').select('*').order('sort_order');
  if (error) throw error;
  return data;
}

async function fetchCultureMaterials(): Promise<CultureMaterialRow[]> {
  const { data, error } = await supabase.from('culture_materials').select('*').order('sort_order');
  if (error) throw error;
  return data;
}

export function useCultureCategories() {
  return useQuery({ queryKey: ['culture_categories'], queryFn: fetchCultureCategories });
}

export function useCultureMaterials() {
  return useQuery({ queryKey: ['culture_materials'], queryFn: fetchCultureMaterials });
}
