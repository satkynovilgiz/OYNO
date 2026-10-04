/**
 * Game Practice Academy - authored missions on top of the EXISTING Practice
 * mode. No physics, scoring or game changes: a mission only reads the
 * numbers a practice round already produces at its RESULT screen.
 *
 * Audited (2026-10-04) from each game's own code:
 *   Jaa Atuu   practice = 15 arrows (PRACTICE_ARROWS); rings score
 *              10/25/50/100; summary: totalScore, accuracyPercent,
 *              bullseyes, bestShot.
 *   Kyz Kuumai practice = solo course (~71 m, 4 waypoints) ending at the
 *              finish; summary: elapsedSeconds, topSpeed (cruise 6 m/s,
 *              sprint 11 m/s), checkpoints.
 *   Kok Boru   practice = 90 s round; goals scored = practiceScoreCount.
 *   Ordo, Chuko: practice never reaches a result (open-ended reset/exit),
 *              so there is no finished round to evaluate -> no missions.
 */

export type PracticeComparison = 'gte' | 'lte';
export type PracticeMission = { id: string; gameId: string; metric: string; comparison: PracticeComparison; target: number; titleKey: string; descriptionKey: string };

const mission = (id: string, gameId: string, metric: string, comparison: PracticeComparison, target: number): PracticeMission => ({
  id,
  gameId,
  metric,
  comparison,
  target,
  titleKey: `practiceAcademy.missions.${id}.title`,
  descriptionKey: `practiceAcademy.missions.${id}.description`,
});

export const PRACTICE_MISSIONS: readonly PracticeMission[] = [
  mission('jaa_accuracy_60', 'jaa_atuu', 'accuracy', 'gte', 60),
  mission('jaa_one_bullseye', 'jaa_atuu', 'bullseyes', 'gte', 1),
  mission('jaa_score_400', 'jaa_atuu', 'score', 'gte', 400),
  mission('kyz_finish_15s', 'kyz_kuumai', 'seconds', 'lte', 15),
  mission('kyz_top_speed_9', 'kyz_kuumai', 'topSpeed', 'gte', 9),
  mission('kok_one_goal', 'kok_boru', 'goals', 'gte', 1),
  mission('kok_two_goals', 'kok_boru', 'goals', 'gte', 2),
];

/** Where a target must lie for each metric (from the game code above). */
export const METRIC_RANGES: Record<string, Record<string, { min: number; max: number }>> = {
  jaa_atuu: { accuracy: { min: 0, max: 100 }, bullseyes: { min: 0, max: 15 }, score: { min: 0, max: 1500 } },
  kyz_kuumai: { seconds: { min: 0, max: 600 }, topSpeed: { min: 0, max: 11 } },
  kok_boru: { goals: { min: 0, max: 30 } },
};

export function missionById(id: string | null | undefined): PracticeMission | null {
  return PRACTICE_MISSIONS.find((entry) => entry.id === id) ?? null;
}

export function missionsFor(gameId: string): PracticeMission[] {
  return PRACTICE_MISSIONS.filter((entry) => entry.gameId === gameId);
}

/** A FINISHED practice round (abandoned rounds never produce one). */
export type PracticeRoundResult = { gameId: string; practice: boolean; finished: boolean; metrics: Record<string, number> };

export type MissionEvaluation = { completed: boolean; actual: number | null; target: number; progress: number };

/** Pure: no UI. Wrong game, a non-practice or unfinished round, or a
 * missing metric never counts. */
export function evaluatePracticeMission(missionDef: PracticeMission, result: PracticeRoundResult | null): MissionEvaluation {
  const none = { completed: false, actual: null, target: missionDef.target, progress: 0 };
  if (!result || result.gameId !== missionDef.gameId || !result.practice || !result.finished) return none;
  const actual = result.metrics[missionDef.metric];
  if (typeof actual !== 'number' || !Number.isFinite(actual)) return none;
  const completed = missionDef.comparison === 'gte' ? actual >= missionDef.target : actual <= missionDef.target;
  const progress = missionDef.comparison === 'gte' ? Math.min(1, Math.max(0, actual / missionDef.target)) : completed ? 1 : Math.min(1, Math.max(0, missionDef.target / actual));
  return { completed, actual, target: missionDef.target, progress };
}

/** Coach tip -> the practice mission that trains the same thing (explicit, authored). */
export const COACH_TIP_MISSION: Record<string, string> = {
  jaa_aim_first: 'jaa_accuracy_60',
  jaa_center: 'jaa_one_bullseye',
  kyz_save_sprint: 'kyz_top_speed_9',
  kok_carry_to_goal: 'kok_one_goal',
};

export function validateMissions(missions: readonly PracticeMission[]): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const entry of missions) {
    if (ids.has(entry.id)) problems.push(`${entry.id}: duplicate`);
    ids.add(entry.id);
    const range = METRIC_RANGES[entry.gameId]?.[entry.metric];
    if (!range) problems.push(`${entry.id}: unknown metric`);
    else if (entry.target <= range.min || entry.target > range.max) problems.push(`${entry.id}: target out of range`);
  }
  for (const gameId of new Set(missions.map((entry) => entry.gameId))) {
    const count = missions.filter((entry) => entry.gameId === gameId).length;
    if (count > 4) problems.push(`${gameId}: more than 4 missions`);
  }
  return problems;
}
