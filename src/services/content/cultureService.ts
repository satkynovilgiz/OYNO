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

async function fetchCultureMaterial(id: string): Promise<CultureMaterialRow | null> {
  const { data, error } = await supabase.from('culture_materials').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export function useCultureCategories() {
  return useQuery({ queryKey: ['culture_categories'], queryFn: fetchCultureCategories });
}

export function useCultureMaterials() {
  return useQuery({ queryKey: ['culture_materials'], queryFn: fetchCultureMaterials });
}

export function useCultureMaterial(id: string) {
  return useQuery({ queryKey: ['culture_material', id], queryFn: () => fetchCultureMaterial(id) });
}
