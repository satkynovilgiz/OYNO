import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/services/supabase/client';

import type { QuestStepRow } from './types';

async function fetchQuestSteps(questId: string): Promise<QuestStepRow[]> {
  const { data, error } = await supabase.from('quest_steps').select('*').eq('quest_id', questId).order('step_order');
  if (error) throw error;
  return data;
}

export function useQuestSteps(questId: string | undefined) {
  return useQuery({
    queryKey: ['quest_steps', questId],
    queryFn: () => fetchQuestSteps(questId as string),
    enabled: !!questId,
  });
}
