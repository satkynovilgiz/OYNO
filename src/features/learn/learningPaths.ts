/**
 * Learning Paths - curated sequences of EXISTING OYNO experiences. Config
 * only: every step references real content by id; no article text,
 * questions, audio or game data is copied. Progress is DERIVED from the
 * signals those experiences already record; a step with no reliable signal
 * (the Boz Üy builder only records a visit) uses an explicit "Mark step
 * complete". Opening a step never completes it. No locking, no rewards.
 */

export type StepType = 'culture_item' | 'glossary' | 'challenge' | 'game' | 'interactive_lab';

export type LearningPathStep = {
  id: string;
  type: StepType;
  /** Real content id: culture item id, glossary entry id, challenge id
   * (`collection-<id>`), game progress id, or lab id. */
  targetId: string;
};

export type LearningPath = {
  id: string;
  titleKey: string;
  descriptionKey: string;
  /** Culture item whose image is the hero (bundled), if any. */
  heroItemId: string | null;
  steps: LearningPathStep[];
};

export type LabId = 'boz-uy' | 'oymo' | 'shyrdak' | 'komuz';

export const LEARNING_PATHS: LearningPath[] = [
  {
    id: 'boz-uy',
    titleKey: 'learningPaths.paths.boz-uy.title',
    descriptionKey: 'learningPaths.paths.boz-uy.description',
    heroItemId: 'boz-uy-overview',
    steps: [
      { id: 'read-overview', type: 'culture_item', targetId: 'boz-uy-overview' },
      { id: 'read-frame', type: 'culture_item', targetId: 'boz-uy-karkas' },
      { id: 'term-tunduk', type: 'glossary', targetId: 'tunduk' },
      { id: 'build', type: 'interactive_lab', targetId: 'boz-uy' },
      { id: 'challenge', type: 'challenge', targetId: 'collection-boz-uy-world' },
    ],
  },
  {
    id: 'felt-oymo',
    titleKey: 'learningPaths.paths.felt-oymo.title',
    descriptionKey: 'learningPaths.paths.felt-oymo.description',
    heroItemId: 'shyrdak-craft',
    steps: [
      { id: 'read-oymo', type: 'culture_item', targetId: 'oymo-overview' },
      { id: 'read-shyrdak', type: 'culture_item', targetId: 'shyrdak-craft' },
      { id: 'term-ala-kiyiz', type: 'glossary', targetId: 'ala-kiyiz' },
      { id: 'lab-oymo', type: 'interactive_lab', targetId: 'oymo' },
      { id: 'lab-shyrdak', type: 'interactive_lab', targetId: 'shyrdak' },
      { id: 'challenge', type: 'challenge', targetId: 'collection-kyrgyz-ornament' },
    ],
  },
  {
    id: 'horse-games',
    titleKey: 'learningPaths.paths.horse-games.title',
    descriptionKey: 'learningPaths.paths.horse-games.description',
    heroItemId: 'horse-kok-boru',
    steps: [
      { id: 'read-kok-boru', type: 'culture_item', targetId: 'horse-kok-boru' },
      { id: 'play-kok-boru', type: 'game', targetId: 'kok_boru' },
      { id: 'read-kyz-kuumai', type: 'culture_item', targetId: 'horse-kyz-kuumai' },
      { id: 'play-kyz-kuumai', type: 'game', targetId: 'kyz_kuumai' },
      { id: 'challenge', type: 'challenge', targetId: 'collection-horse-culture' },
    ],
  },
];

const LAB_ROUTE: Record<LabId, string> = {
  'boz-uy': '/culture/boz-uy/build',
  oymo: '/culture/oymo/create',
  shyrdak: '/culture/shyrdak/create',
  komuz: '/culture/komuz/learn',
};

/** Labs whose completion the app really records (progress flags). */
export const LAB_SIGNAL: Partial<Record<LabId, 'oymoCreated' | 'shyrdakCreated' | 'komuzLessonCompleted'>> = {
  oymo: 'oymoCreated',
  shyrdak: 'shyrdakCreated',
  komuz: 'komuzLessonCompleted',
};

export function stepRoute(step: LearningPathStep, gameRoute: (gameId: string) => string | null): string | null {
  switch (step.type) {
    case 'culture_item':
      return `/culture/item/${step.targetId}`;
    case 'glossary':
      return `/culture/glossary/${step.targetId}`;
    case 'challenge':
      return `/challenges/${step.targetId}`;
    case 'game':
      return gameRoute(step.targetId);
    case 'interactive_lab':
      return LAB_ROUTE[step.targetId as LabId] ?? null;
  }
}

/** Steps that need an explicit "Mark step complete" (no reliable signal). */
export function isManualStep(step: LearningPathStep): boolean {
  return step.type === 'interactive_lab' && !LAB_SIGNAL[step.targetId as LabId];
}

export type StepState = 'not_started' | 'in_progress' | 'completed';

/** Every real signal a step can be derived from (gathered by the hook). */
export type PathSignals = {
  readingCompleted: (itemId: string) => boolean;
  readingStarted: (itemId: string) => boolean;
  glossaryGotIt: (entryId: string) => boolean;
  glossarySeen: (entryId: string) => boolean;
  /** `collection:<id>` result keys. */
  challengeCompleted: (challengeId: string) => boolean;
  challengeStarted: (challengeId: string) => boolean;
  /** A real finished (non-practice) round. */
  gamePlayed: (gameId: string) => boolean;
  labFlag: (flag: 'oymoCreated' | 'shyrdakCreated' | 'komuzLessonCompleted') => boolean;
  manualCompleted: (pathId: string, stepId: string) => boolean;
};

export function challengeResultKey(challengeId: string): string {
  return challengeId.startsWith('collection-') ? `collection:${challengeId.slice('collection-'.length)}` : challengeId;
}

export function stepState(path: LearningPath, step: LearningPathStep, signals: PathSignals): StepState {
  switch (step.type) {
    case 'culture_item':
      return signals.readingCompleted(step.targetId) ? 'completed' : signals.readingStarted(step.targetId) ? 'in_progress' : 'not_started';
    case 'glossary':
      return signals.glossaryGotIt(step.targetId) ? 'completed' : signals.glossarySeen(step.targetId) ? 'in_progress' : 'not_started';
    case 'challenge':
      return signals.challengeCompleted(step.targetId) ? 'completed' : signals.challengeStarted(step.targetId) ? 'in_progress' : 'not_started';
    case 'game':
      return signals.gamePlayed(step.targetId) ? 'completed' : 'not_started';
    case 'interactive_lab': {
      const flag = LAB_SIGNAL[step.targetId as LabId];
      if (flag) return signals.labFlag(flag) ? 'completed' : 'not_started';
      return signals.manualCompleted(path.id, step.id) ? 'completed' : 'not_started';
    }
  }
}

export type PathProgress = { states: StepState[]; completed: number; total: number; nextIndex: number | null; done: boolean; started: boolean };

/** Deterministic: the first step (in order) that isn't completed. */
export function pathProgress(path: LearningPath, signals: PathSignals): PathProgress {
  const states = path.steps.map((step) => stepState(path, step, signals));
  const completed = states.filter((state) => state === 'completed').length;
  const next = states.findIndex((state) => state !== 'completed');
  return { states, completed, total: states.length, nextIndex: next >= 0 ? next : null, done: completed === states.length, started: states.some((state) => state !== 'not_started') };
}

/** Home: the active path (started, not done) - the most advanced one,
 * ties by config order - else the first path not done, else null. */
export function pickHomePath(paths: readonly LearningPath[], signals: PathSignals): { path: LearningPath; progress: PathProgress } | null {
  const all = paths.map((path) => ({ path, progress: pathProgress(path, signals) }));
  const active = all.filter((entry) => entry.progress.started && !entry.progress.done).sort((a, b) => b.progress.completed / b.progress.total - a.progress.completed / a.progress.total);
  return active[0] ?? all.find((entry) => !entry.progress.done) ?? null;
}

export function learnRoute(pathId: string): string {
  return `/learn/${pathId}`;
}

/** Integrity: unique ids, real targets, resolvable routes, no duplicate
 * targets, >= 3 steps, localization keys present. */
export function validatePaths(
  paths: readonly LearningPath[],
  catalog: {
    cultureItems: ReadonlySet<string>;
    glossary: ReadonlySet<string>;
    challenges: ReadonlySet<string>;
    games: ReadonlyMap<string, string>;
    hasKey: (key: string) => boolean;
  },
): string[] {
  const problems: string[] = [];
  const pathIds = new Set<string>();
  for (const path of paths) {
    if (pathIds.has(path.id)) problems.push(`duplicate path ${path.id}`);
    pathIds.add(path.id);
    if (path.steps.length < 3) problems.push(`${path.id}: fewer than 3 steps`);
    for (const key of [path.titleKey, path.descriptionKey]) if (!catalog.hasKey(key)) problems.push(`${path.id}: missing string ${key}`);
    const stepIds = new Set<string>();
    const targets = new Set<string>();
    for (const step of path.steps) {
      if (stepIds.has(step.id)) problems.push(`${path.id}: duplicate step ${step.id}`);
      stepIds.add(step.id);
      const target = `${step.type}:${step.targetId}`;
      if (targets.has(target)) problems.push(`${path.id}: duplicate target ${target}`);
      targets.add(target);
      const exists =
        step.type === 'culture_item'
          ? catalog.cultureItems.has(step.targetId)
          : step.type === 'glossary'
            ? catalog.glossary.has(step.targetId)
            : step.type === 'challenge'
              ? catalog.challenges.has(step.targetId)
              : step.type === 'game'
                ? catalog.games.has(step.targetId)
                : step.targetId in LAB_ROUTE;
      if (!exists) problems.push(`${path.id}: ${target} missing`);
      if (!stepRoute(step, (id) => catalog.games.get(id) ?? null)) problems.push(`${path.id}: no route for ${target}`);
    }
  }
  return problems;
}
