/**
 * Weekly Learning Goals - gentle, private planning. NOT a streak, NOT a
 * reward: a new week simply starts again at 0, nothing is lost, nothing is
 * granted.
 *
 * What counts (each completion once, from REAL dated events only):
 *   reading     a Culture article/material reading completed
 *   challenge   a Knowledge Challenge finished (its latest completion)
 *   glossary    a Glossary study session finished
 *   path_step   a Learning Path step marked complete
 *   game        a normal (non-practice) game round finished
 * Never counted: opens, searches, saving, sharing, scrolling, gallery
 * previews. Guided-quest steps carry no dates, so they aren't counted.
 *
 * Week rule: Monday 00:00 -> next Monday 00:00, LOCAL time.
 */

export type ActivityKind = 'reading' | 'challenge' | 'glossary' | 'path_step' | 'game';
export type ActivityEvent = { id: string; kind: ActivityKind; at: string };

export const GOAL_OPTIONS = [3, 5, 7] as const;
export type GoalSize = (typeof GOAL_OPTIONS)[number];

export function isGoalSize(value: unknown): value is GoalSize {
  return (GOAL_OPTIONS as readonly unknown[]).includes(value);
}

/** Local Monday 00:00 of the week containing `date`. */
export function weekStart(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysSinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday);
  return start;
}

/** A stable key for the week ("2026-09-28" = its Monday, local). */
export function weekKey(date: Date): string {
  const start = weekStart(date);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
}

/** Events in the week of `now`, each id counted once. */
export function activitiesThisWeek(events: readonly ActivityEvent[], now: Date): ActivityEvent[] {
  const start = weekStart(now).getTime();
  const end = start + 7 * 24 * 60 * 60 * 1000;
  const seen = new Set<string>();
  return events.filter((event) => {
    const at = new Date(event.at).getTime();
    if (!Number.isFinite(at) || at < start || at >= end || seen.has(event.id)) return false;
    seen.add(event.id);
    return true;
  });
}

export type WeeklyGoalState = { goal: GoalSize; done: number; complete: boolean };

/** Changing the goal mid-week keeps the count (it's derived, not stored). */
export function goalState(goal: GoalSize | null, events: readonly ActivityEvent[], now: Date): WeeklyGoalState | null {
  if (!goal) return null;
  const done = activitiesThisWeek(events, now).length;
  return { goal, done, complete: done >= goal };
}

/** Builds the event list from the existing stores' dated records. */
export function collectActivityEvents(input: {
  readings: readonly { contentType: string; contentId: string; completedAt: string | null }[];
  challengeResults: Record<string, { completedAt: string | null }>;
  glossarySessions: readonly string[];
  manualPathSteps: Record<string, Record<string, string>>;
  gameSessions: readonly { id: string; completedAt: string; practice: boolean }[];
}): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  for (const reading of input.readings) if (reading.completedAt) events.push({ id: `reading:${reading.contentType}:${reading.contentId}`, kind: 'reading', at: reading.completedAt });
  for (const [key, result] of Object.entries(input.challengeResults)) if (result.completedAt) events.push({ id: `challenge:${key}`, kind: 'challenge', at: result.completedAt });
  input.glossarySessions.forEach((at) => events.push({ id: `glossary:${at}`, kind: 'glossary', at }));
  for (const [pathId, steps] of Object.entries(input.manualPathSteps)) for (const [stepId, at] of Object.entries(steps)) events.push({ id: `path:${pathId}:${stepId}`, kind: 'path_step', at });
  for (const session of input.gameSessions) if (!session.practice) events.push({ id: `game:${session.id}`, kind: 'game', at: session.completedAt });
  return events;
}
