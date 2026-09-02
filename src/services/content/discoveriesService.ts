import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/services/supabase/client';

import type { DiscoveryRow } from './types';

async function fetchDiscoveries(): Promise<DiscoveryRow[]> {
  const { data, error } = await supabase.from('discoveries').select('*').eq('published', true).order('sort_order');
  if (error) throw error;
  return data;
}

export function useDiscoveries() {
  return useQuery({ queryKey: ['discoveries'], queryFn: fetchDiscoveries });
}
