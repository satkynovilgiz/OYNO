import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/services/supabase/client';

import type { MotifLayer } from '@/services/culture/oymoEditor';
import type { SymmetryMode } from '@/services/culture/symmetry';

export type OymoCreationRow = {
  id: string;
  name: string;
  layers: MotifLayer[];
  background_color: string;
  symmetry_mode: SymmetryMode;
  created_at: string;
  updated_at: string;
};

async function fetchOymoCreations(): Promise<OymoCreationRow[]> {
  const { data, error } = await supabase.from('oymo_creations').select('*').order('updated_at', { ascending: false });
  if (error) throw error;
  return data;
}

/** Select-only from the client (RLS: owning user only) - all writes go
 * through save_oymo_creation/delete_oymo_creation RPCs
 * (useProgressStore), never a direct insert/update/delete here, since
 * saving awards XP on first save and only a SECURITY DEFINER function can
 * be trusted with that. */
export function useOymoCreations() {
  return useQuery({ queryKey: ['oymo_creations'], queryFn: fetchOymoCreations });
}
