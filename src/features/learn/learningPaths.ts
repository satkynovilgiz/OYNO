/**
 * Learning Paths - curated sequences of EXISTING OYNO experiences. Config
 * only: every step references real content by id; no article text,
 * questions, audio or game data is copied. Progress is DERIVED from the
 * signals those experiences already record; a step with no reliable signal
 * (the Boz Üy builder only records a visit) uses an explicit "Mark step
 * complete". Opening a step never completes it. No locking, no rewards.
 */

/** `memory` = Build from Memory, `connection` = one entry of the sourced connections dataset,
 * `reflection` = a personal journal entry (always optional). */
export type StepType = 'culture_item' | 'glossary' | 'challenge' | 'game' | 'interactive_lab' | 'memory' | 'connection' | 'reflection';

export type LearningPathStep = {
  id: string;
  type: StepType;
  /** Real content id: culture item id, glossary entry id, challenge id
   * (`collection-<id>`), game progress id, or lab id. */
  targetId: string;
  /** May be skipped (and un-skipped); a skipped step doesn't block finishing the path. */
  optional?: boolean;
  /** Why this step is in the path: an authored instruction (no new cultural claim). */
  whyKey?: string;
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
  {
    // "Inside a boz uy": the article, Build from Memory, one sourced connection, your own Oymo design, an optional reflection.
    id: 'inside-boz-uy',
    titleKey: 'learningPaths.paths.inside-boz-uy.title',
    descriptionKey: 'learningPaths.paths.inside-boz-uy.description',
    heroItemId: 'boz-uy-overview',
    steps: [
      { id: 'discover', type: 'culture_item', targetId: 'boz-uy-overview', whyKey: 'learningPaths.paths.inside-boz-uy.why.discover' },
      { id: 'build-from-memory', type: 'memory', targetId: 'boz-uy', whyKey: 'learningPaths.paths.inside-boz-uy.why.build-from-memory' },
      { id: 'connection', type: 'connection', targetId: 'tunduk-part-of-karkas', whyKey: 'learningPaths.paths.inside-boz-uy.why.connection' },
      { id: 'oymo-design', type: 'interactive_lab', targetId: 'oymo', whyKey: 'learningPaths.paths.inside-boz-uy.why.oymo-design' },
      { id: 'reflection', type: 'reflection', targetId: 'journal', optional: true, whyKey: 'learningPaths.paths.inside-boz-uy.why.reflection' },
    ],
  },
];

/** Build from Memory activities by target id. */
export const MEMORY_ROUTE: Record<string, string> = { 'boz-uy': '/culture/boz-uy/memory' };
export const REFLECTION_ROUTE: Record<string, string> = { journal: '/journal/new' };

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
    case 'memory':
      return MEMORY_ROUTE[step.targetId] ?? null;
    case 'connection':
      return `/culture/connections/${step.targetId}`;
    case 'reflection':
      return REFLECTION_ROUTE[step.targetId] ?? null;
  }
}

/** Steps that need an explicit "Mark step complete" (no reliable signal). */
export function isManualStep(step: LearningPathStep): boolean {
  if (step.type === 'memory' || step.type === 'connection' || step.type === 'reflection') return true;
  return step.type === 'interactive_lab' && !LAB_SIGNAL[step.targetId as LabId];
}

/** `skipped` = an optional step the person chose to skip. */
export type StepState = 'not_started' | 'in_progress' | 'completed' | 'skipped';
/** What the journey store recorded (visited from the path, skipped). Absent for plain paths. */
export type JourneySignals = { visited: (stepId: string) => boolean; skipped: (stepId: string) => boolean };
const NO_JOURNEY: JourneySignals = { visited: () => false, skipped: () => false };

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

/** A path's challenge step may point at a collection challenge or - only
 * when explicitly configured - a Culture Topic Quiz (`topic-<id>`). */
export function challengeResultKey(challengeId: string): string {
  if (challengeId.startsWith('collection-')) return `collection:${challengeId.slice('collection-'.length)}`;
  if (challengeId.startsWith('topic-')) return `topic:${challengeId.slice('topic-'.length)}`;
  return challengeId;
}

export function stepState(path: LearningPath, step: LearningPathStep, signals: PathSignals, journey: JourneySignals = NO_JOURNEY): StepState {
  const base = signalState(path, step, signals);
  if (base === 'completed') return base;
  if (step.optional && journey.skipped(step.id)) return 'skipped';
  // Visited only says it was opened - never finished.
  return base === 'not_started' && journey.visited(step.id) ? 'in_progress' : base;
}

function signalState(path: LearningPath, step: LearningPathStep, signals: PathSignals): StepState {
  switch (step.type) {
    case 'memory':
    case 'connection':
    case 'reflection':
      return signals.manualCompleted(path.id, step.id) ? 'completed' : 'not_started';
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
export function pathProgress(path: LearningPath, signals: PathSignals, journey: JourneySignals = NO_JOURNEY): PathProgress {
  const states = path.steps.map((step) => stepState(path, step, signals, journey));
  const completed = states.filter((state) => state === 'completed').length;
  // A skipped (optional) step is passed over, never counted as finished.
  const next = states.findIndex((state) => state !== 'completed' && state !== 'skipped');
  return { states, completed, total: states.length, nextIndex: next >= 0 ? next : null, done: next < 0, started: states.some((state) => state !== 'not_started') };
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
    /** Connection dataset ids (sourced connections). */
    connections?: ReadonlySet<string>;
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
                : step.type === 'memory'
                  ? step.targetId in MEMORY_ROUTE
                  : step.type === 'connection'
                    ? !!catalog.connections?.has(step.targetId)
                    : step.type === 'reflection'
                      ? step.targetId in REFLECTION_ROUTE
                      : step.targetId in LAB_ROUTE;
      if (step.type === 'reflection' && !step.optional) problems.push(`${path.id}: a reflection step must be optional`);
      if (step.whyKey && !catalog.hasKey(step.whyKey)) problems.push(`${path.id}: missing string ${step.whyKey}`);
      if (!exists) problems.push(`${path.id}: ${target} missing`);
      if (!stepRoute(step, (id) => catalog.games.get(id) ?? null)) problems.push(`${path.id}: no route for ${target}`);
    }
  }
  return problems;
}

// ---------------------------------------------------------------------
// Guided journey: the path context a step screen was opened with
// (`?fromPath=<id>`) and what to offer next. Derived from the same signals
// as pathProgress - no second progress engine, nothing stored.
// ---------------------------------------------------------------------

/** The step of `fromPath` that `pathname` is - or null when the screen was
 * opened independently (no/unknown path, or a route that is not one of
 * that path's steps). A direct link never gets an unrelated path. */
export function pathContextFor(
  fromPath: string | undefined,
  pathname: string,
  gameRoute: (gameId: string) => string | null,
  paths: readonly LearningPath[] = LEARNING_PATHS,
): { path: LearningPath; stepIndex: number } | null {
  if (!fromPath) return null;
  const path = paths.find((candidate) => candidate.id === fromPath);
  if (!path) return null;
  const stepIndex = path.steps.findIndex((step) => stepRoute(step, gameRoute) === pathname);
  return stepIndex >= 0 ? { path, stepIndex } : null;
}

export type Continuation =
  /** The activity is not finished yet - offer nothing (opening never completes). */
  | { kind: 'pending' }
  /** No reliable completion evidence: the person confirms it themselves. */
  | { kind: 'confirm'; step: LearningPathStep }
  /** Finished: the next INCOMPLETE step (completed ones are skipped). */
  | { kind: 'next'; step: LearningPathStep; index: number }
  /** Every step done: suggest another path that is not finished, if any. */
  | { kind: 'done'; otherPath: LearningPath | null };

export function pathContinuation(path: LearningPath, stepIndex: number, signals: PathSignals, paths: readonly LearningPath[] = LEARNING_PATHS): Continuation {
  const progress = pathProgress(path, signals);
  const step = path.steps[stepIndex];
  if (progress.states[stepIndex] !== 'completed') return isManualStep(step) ? { kind: 'confirm', step } : { kind: 'pending' };
  if (progress.nextIndex === null) {
    const others = paths.filter((candidate) => candidate.id !== path.id).map((candidate) => ({ candidate, progress: pathProgress(candidate, signals) }));
    const other = others.find((entry) => entry.progress.started && !entry.progress.done) ?? others.find((entry) => !entry.progress.done);
    return { kind: 'done', otherPath: other?.candidate ?? null };
  }
  // Same rule as the path screen's Continue: the first step, in order, not completed.
  return { kind: 'next', step: path.steps[progress.nextIndex], index: progress.nextIndex };
}

/** Same owner the journey started with? A different account never inherits it. */
export function pathContextValid(startedOwner: string | null, owner: string): boolean {
  return startedOwner === null || startedOwner === owner;
}
