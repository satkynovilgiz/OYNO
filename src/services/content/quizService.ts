import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/services/supabase/client';

export type QuizQuestionRow = {
  id: string;
  question: string;
  choices: string[];
};

/** Uses get_quiz_questions() (a SECURITY DEFINER function), not a direct
 * table select - culture_quiz_questions has RLS enabled with no select
 * policy at all, so the function is the only way to read a question, and
 * it deliberately never returns correct_index. See the migration's own
 * comment for why. */
async function fetchQuizQuestions(): Promise<QuizQuestionRow[]> {
  const { data, error } = await supabase.rpc('get_quiz_questions');
  if (error) throw error;
  return data as QuizQuestionRow[];
}

export function useQuizQuestions() {
  return useQuery({ queryKey: ['quiz_questions'], queryFn: fetchQuizQuestions });
}
