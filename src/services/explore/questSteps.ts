export type QuestStepType = 'VISIT_LOCATION' | 'DISCOVER_ITEM' | 'OPEN_CULTURE_ITEM' | 'COMPLETE_QUIZ';

export type QuestStep = {
  id: string;
  questId: string;
  stepOrder: number;
  stepType: QuestStepType;
  targetId: string;
};

/**
 * The server (advance_quest_step RPC) is the actual authority on step
 * order/completion - this mirrors that ordering client-side purely to
 * decide two UI questions: what's the next step to show, and where does
 * tapping it navigate. A client guess that's wrong is harmless (the RPC
 * rejects a mismatched step), it just means a stale CTA destination.
 */
export function findNextIncompleteStep(steps: QuestStep[], completedStepIds: string[]): QuestStep | null {
  const sorted = [...steps].sort((a, b) => a.stepOrder - b.stepOrder);
  return sorted.find((step) => !completedStepIds.includes(step.id)) ?? null;
}

/** A discovery's region, when it has one - used to route DISCOVER_ITEM
 * steps to that region's detail page instead of the bare Explore home. */
export function resolveStepRoute(step: QuestStep, discoveryRegionId?: string | null): string {
  switch (step.stepType) {
    case 'VISIT_LOCATION':
      return `/explore/${step.targetId}`;
    case 'DISCOVER_ITEM':
      return discoveryRegionId ? `/explore/${discoveryRegionId}` : '/explore';
    case 'OPEN_CULTURE_ITEM':
      return `/culture/item/${step.targetId}`;
    case 'COMPLETE_QUIZ':
      return '/culture';
  }
}
