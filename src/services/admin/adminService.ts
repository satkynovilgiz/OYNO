import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/services/supabase/client';

export type AdminRole = 'super_admin' | 'content_editor' | 'moderator' | 'analytics_viewer';

/** Client-side check is only ever a UI convenience (hide the admin entry
 * point, show a friendly "not authorized" screen) - every actual write
 * goes through a SECURITY DEFINER function that re-checks
 * require_admin_role() itself server-side, so there's no way to bypass
 * this by skipping the client check. */
async function fetchAdminRole(): Promise<AdminRole | null> {
  const { data, error } = await supabase.rpc('current_admin_role');
  if (error) throw error;
  return (data as AdminRole | null) ?? null;
}

export function useAdminRole() {
  return useQuery({ queryKey: ['admin_role'], queryFn: fetchAdminRole });
}

export const CONTENT_EDITOR_ROLES: AdminRole[] = ['super_admin', 'content_editor'];

/** Generic content-row fetch for any admin-managed table - every table
 * these sections cover is either public-read (culture_categories/
 * materials/items, explore_regions, quests) or has a dedicated admin read
 * RPC (culture_quiz_questions, since its public read intentionally omits
 * correct_index) - see AdminSectionConfig.fetch in features/admin/sections.ts
 * for which one each section uses. */
export async function fetchTable<T>(table: string, orderBy = 'sort_order'): Promise<T[]> {
  const { data, error } = await supabase.from(table).select('*').order(orderBy);
  if (error) throw error;
  return data as T[];
}

export async function fetchViaRpc<T>(fn: string): Promise<T[]> {
  const { data, error } = await supabase.rpc(fn);
  if (error) throw error;
  return data as T[];
}

export async function callAdminRpc(fn: string, params: Record<string, unknown>) {
  const { error } = await supabase.rpc(fn, params);
  if (error) throw error;
}
