import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/services/supabase/client';

import type { SymmetryMode } from '@/services/culture/symmetry';

export type ShyrdakCreationRow = {
  user_id: string;
  base_color: string;
  secondary_color: string;
  pattern_id: string;
  border_enabled: boolean;
  symmetry_mode: SymmetryMode;
  updated_at: string;
};

async function fetchShyrdakCreation(): Promise<ShyrdakCreationRow | null> {
  const { data, error } = await supabase.from('shyrdak_creations').select('*').maybeSingle();
  if (error) throw error;
  return data;
}

/** Single row per user (RLS: owning user only, select-only from the
 * client) - saving goes through save_shyrdak_creation (an upsert on
 * user_id), same "reward-adjacent write needs a SECURITY DEFINER RPC"
 * reasoning as Oymo creations. */
export function useShyrdakCreation() {
  return useQuery({ queryKey: ['shyrdak_creation'], queryFn: fetchShyrdakCreation });
}
