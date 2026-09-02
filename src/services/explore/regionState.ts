/**
 * Region/nature-site state model. Pure and DB-shape-agnostic on purpose -
 * callers (map badges, region list, detail screen) each already have their
 * own row shapes, so this only takes the small set of real facts the state
 * actually depends on: is the row published, has the user visited it, and
 * how much of its *real* linked content (discoveries tied to this region,
 * quest steps targeting it) is done.
 */
export type RegionState = 'locked' | 'available' | 'started' | 'explored' | 'completed';

export type RegionCompletionInput = {
  published: boolean;
  visited: boolean;
  discoveriesTotal: number;
  discoveriesFound: number;
  questStepsTotal: number;
  questStepsCompleted: number;
};

export type RegionCompletion = {
  percent: number;
  state: RegionState;
};

export function calculateRegionCompletion(input: RegionCompletionInput): RegionCompletion {
  const { published, visited, discoveriesTotal, discoveriesFound, questStepsTotal, questStepsCompleted } = input;

  if (!published) {
    return { percent: 0, state: 'locked' };
  }

  if (!visited) {
    return { percent: 0, state: 'available' };
  }

  // Visiting itself is one step; each linked discovery/quest-step is another -
  // an honest percent, not a padded one (a region with nothing linked yet
  // reads as 100% the moment it's visited, since there's nothing left to do).
  const totalSteps = 1 + discoveriesTotal + questStepsTotal;
  const doneSteps = 1 + Math.min(discoveriesFound, discoveriesTotal) + Math.min(questStepsCompleted, questStepsTotal);
  const percent = Math.round((doneSteps / totalSteps) * 100);

  const discoveriesDone = discoveriesFound >= discoveriesTotal;
  const questStepsDone = questStepsCompleted >= questStepsTotal;

  if (!discoveriesDone || (questStepsTotal > 0 && !questStepsDone)) {
    return { percent, state: 'started' };
  }

  if (questStepsTotal > 0 && questStepsDone) {
    return { percent, state: 'completed' };
  }

  return { percent, state: 'explored' };
}
