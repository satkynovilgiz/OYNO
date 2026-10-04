import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { track } from '@/services/analytics/analytics';
import { usePracticeMissionsStore } from '@/store/usePracticeMissionsStore';

import { currentRecordsOwner } from '../records/useGameRecords';
import { evaluatePracticeMission, missionById, type MissionEvaluation, type PracticeMission } from './practiceMissions';

/** "Goal: Accuracy 60%" etc. - text, never colour alone. */
export function goalValueText(mission: PracticeMission, value: number, t: (key: string, options?: Record<string, unknown>) => string): string {
  return t(`practiceAcademy.metric.${mission.metric}`, { value: Math.round(value * 10) / 10, count: Math.round(value) });
}

/**
 * For a game's PRACTICE round: the active mission (if any), its HUD text,
 * and `finishRound(metrics)` - called ONLY from the RESULT phase, so an
 * abandoned/quit round never counts. Reads results; never touches records.
 */
export function usePracticeMission(gameId: string, missionId: string | null | undefined) {
  const { t } = useTranslation();
  const mission = missionById(missionId);
  const active = mission && mission.gameId === gameId ? mission : null;
  const [evaluation, setEvaluation] = useState<MissionEvaluation | null>(null);

  const finishRound = useCallback(
    (metrics: Record<string, number>) => {
      if (!active) return;
      const result = evaluatePracticeMission(active, { gameId, practice: true, finished: true, metrics });
      setEvaluation(result);
      if (result.completed) {
        void usePracticeMissionsStore
          .getState()
          .load()
          .then(() => usePracticeMissionsStore.getState().complete(currentRecordsOwner(), active.id));
        track('practice_mission_completed', { game_id: gameId, mission_id: active.id });
      }
    },
    [active, gameId],
  );

  const goalText = active ? `${t('practiceAcademy.goal')}: ${goalValueText(active, active.target, t)}` : null;
  const resultGoal =
    active && evaluation
      ? {
          completed: evaluation.completed,
          title: t(active.titleKey),
          progressText: evaluation.actual === null ? '' : `${goalValueText(active, evaluation.actual, t)} / ${goalValueText(active, active.target, t)}`,
        }
      : null;
  return { mission: active, goalText, finishRound, resultGoal, reset: () => setEvaluation(null) };
}
