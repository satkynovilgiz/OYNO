import type { AgeGroup, StudyQueueInput } from '../studyQueue';

/**
 * Study Planner + Focus Sessions - a short, fixed run over the SAME
 * unfinished learning the Study Queue lists. Nothing new is taught or
 * scored: every activity is done in its existing screen (Challenge Review,
 * glossary flashcards, Learning Path step, article reader) and counts as
 * done ONLY from that system's own record changing after the session
 * started. The session itself records nothing into Weekly Goal, XP or
 * streaks - the underlying screens already do, exactly once.
 */

export const SESSION_SIZES = { quick: 3, standard: 5, deep: 8 } as const;
export type SessionSize = keyof typeof SESSION_SIZES;

export type ActivityType = 'mistake' | 'glossary' | 'path_step' | 'reading';

export type SessionActivity = {
  key: string;
  type: ActivityType;
  /** questionId / glossary entry id / path id / reading key */
  refId: string;
  route: string;
  /** path_step: the step index that was next when the session started. */
  stepIndex?: number;
  /** reading: furthest point (0..1) when the session started. */
  baseline?: number;
};

export type ActivityStatus = 'pending' | 'done' | 'skipped';
export type SessionActivityState = SessionActivity & { status: ActivityStatus; attempted: boolean };

export type FocusSession = {
  owner: string;
  size: SessionSize;
  startedAt: string;
  activities: SessionActivityState[];
  endedAt: string | null;
  endedEarly: boolean;
};

/** Sizes offered per age mode (children get short sessions only). */
export function sizesFor(age: AgeGroup): SessionSize[] {
  if (age === 'child') return ['quick'];
  if (age === 'preteen') return ['quick', 'standard'];
  return ['quick', 'standard', 'deep'];
}

/**
 * Review first (mistakes, then glossary terms), then the next step of each
 * active Learning Path, then unfinished reading. Up to `SESSION_SIZES[size]`
 * activities, no duplicates, never padded: fewer available -> a shorter session.
 */
export function buildStudySession(input: StudyQueueInput, size: SessionSize, readingFurthest: Readonly<Record<string, number>> = {}): SessionActivity[] {
  const limit = SESSION_SIZES[size];
  const seen = new Set<string>();
  const out: SessionActivity[] = [];
  const add = (activity: SessionActivity) => {
    if (out.length >= limit || seen.has(activity.key)) return;
    seen.add(activity.key);
    out.push(activity);
  };
  for (const id of input.mistakeIds) add({ key: `mistake:${id}`, type: 'mistake', refId: id, route: '/challenges/review' });
  for (const id of input.glossaryIds) add({ key: `glossary:${id}`, type: 'glossary', refId: id, route: `/culture/glossary/${id}` });
  for (const path of input.activePaths) {
    if (path.nextStepRoute && typeof path.nextIndex === 'number') add({ key: `path:${path.id}:${path.nextIndex}`, type: 'path_step', refId: path.id, route: path.nextStepRoute, stepIndex: path.nextIndex });
  }
  for (const reading of input.unfinishedReading) add({ key: `reading:${reading.key}`, type: 'reading', refId: reading.key, route: reading.route, baseline: readingFurthest[reading.key] ?? 0 });
  return out;
}

export function startSession(owner: string, size: SessionSize, activities: readonly SessionActivity[], now = new Date()): FocusSession {
  return { owner, size, startedAt: now.toISOString(), activities: activities.map((activity) => ({ ...activity, status: 'pending', attempted: false })), endedAt: null, endedEarly: false };
}

/** The real records each activity type is judged by. */
export type CompletionSignals = {
  mistakes: { active: Readonly<Record<string, { lastWrongAt: string }>>; reviewedAt: Readonly<Record<string, string>> };
  glossary: Readonly<Record<string, { lastReviewedAt: string }>>;
  /** Per path id: each step's state from pathProgress(). */
  pathStates: Readonly<Record<string, readonly string[]>>;
  reading: Readonly<Record<string, { furthest: number; completedAt: string | null }>>;
};

/** Reading counts once it is finished or moved on by at least this much. */
export const READING_PROGRESS_STEP = 0.1;

export function activityDone(activity: SessionActivity, signals: CompletionSignals, startedAt: string): boolean {
  switch (activity.type) {
    case 'mistake':
      // Answered in Review after the session began - right (left the queue) or wrong (count bumped).
      return (signals.mistakes.reviewedAt[activity.refId] ?? '') > startedAt || (signals.mistakes.active[activity.refId]?.lastWrongAt ?? '') > startedAt;
    case 'glossary':
      return (signals.glossary[activity.refId]?.lastReviewedAt ?? '') > startedAt;
    case 'path_step':
      return activity.stepIndex !== undefined && signals.pathStates[activity.refId]?.[activity.stepIndex] === 'completed';
    case 'reading': {
      const record = signals.reading[activity.refId];
      return !!record && (!!record.completedAt || record.furthest >= (activity.baseline ?? 0) + READING_PROGRESS_STEP);
    }
  }
}

/** Marks pending activities done when their real signal says so. Returns the same object when nothing changed. */
export function refreshSession(session: FocusSession, signals: CompletionSignals): FocusSession {
  let changed = false;
  const activities = session.activities.map((activity) => {
    if (activity.status !== 'pending' || !activityDone(activity, signals, session.startedAt)) return activity;
    changed = true;
    return { ...activity, status: 'done' as const };
  });
  return changed ? { ...session, activities } : session;
}

export function markAttempted(session: FocusSession, keys: readonly string[]): FocusSession {
  return { ...session, activities: session.activities.map((activity) => (keys.includes(activity.key) ? { ...activity, attempted: true } : activity)) };
}

export function skipActivity(session: FocusSession, key: string): FocusSession {
  return { ...session, activities: session.activities.map((activity) => (activity.key === key && activity.status === 'pending' ? { ...activity, status: 'skipped' as const } : activity)) };
}

export function currentActivity(session: FocusSession): SessionActivityState | null {
  return session.activities.find((activity) => activity.status === 'pending') ?? null;
}

/** Consecutive pending activities of the same review type run together in their existing screen. */
export function currentGroup(session: FocusSession): SessionActivityState[] {
  const current = currentActivity(session);
  if (!current) return [];
  if (current.type !== 'mistake' && current.type !== 'glossary') return [current];
  const start = session.activities.indexOf(current);
  const group: SessionActivityState[] = [];
  for (const activity of session.activities.slice(start)) {
    if (activity.status !== 'pending') continue;
    if (activity.type !== current.type) break;
    group.push(activity);
  }
  return group;
}

export function isFinished(session: FocusSession): boolean {
  return session.endedAt !== null || session.activities.every((activity) => activity.status !== 'pending');
}

export function endSession(session: FocusSession, now = new Date()): FocusSession {
  if (session.endedAt) return session;
  return { ...session, endedAt: now.toISOString(), endedEarly: session.activities.some((activity) => activity.status === 'pending') };
}

export function sessionSummary(session: FocusSession): { requested: number; total: number; completed: number; skipped: number; remaining: number } {
  const count = (status: ActivityStatus) => session.activities.filter((activity) => activity.status === status).length;
  return { requested: SESSION_SIZES[session.size], total: session.activities.length, completed: count('done'), skipped: count('skipped'), remaining: count('pending') };
}

/** A session belongs to one owner: another account (or guest) never sees or continues it. */
export function sessionFor(session: FocusSession | null, owner: string): FocusSession | null {
  return session && session.owner === owner ? session : null;
}

export const FOCUS_SESSION_ROUTE = '/study/session';
