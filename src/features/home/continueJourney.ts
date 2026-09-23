/**
 * The four real interactive-experience completion flags (server-side
 * user_progress columns) and the one shared check over them - read by
 * Collections, Guided Trails, Journey and Home's recommendation so they
 * all agree on what "tried" means. (The old single-card resolver that
 * lived here was replaced by homeRecommendation.ts.)
 */
export type InteractiveCompletionFlags = {
  bozUyVisited: boolean;
  oymoCreated: boolean;
  shyrdakCreated: boolean;
  komuzLessonCompleted: boolean;
};

const COMPLETION_KEY_BY_EXPERIENCE: Record<string, keyof InteractiveCompletionFlags> = {
  'boz-uy': 'bozUyVisited',
  oymo: 'oymoCreated',
  shyrdak: 'shyrdakCreated',
  komuz: 'komuzLessonCompleted',
};

export function isInteractiveExperienceCompleted(experienceId: string, flags: InteractiveCompletionFlags): boolean {
  const key = COMPLETION_KEY_BY_EXPERIENCE[experienceId];
  return key ? flags[key] : false;
}
