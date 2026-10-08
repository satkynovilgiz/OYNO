import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useTodayDiscovery } from '@/features/daily/useTodayDiscovery';
import { useRecordsOwner } from '@/features/games/records/useGameRecords';
import { progressGameIdFor } from '@/features/games/progressGameIds';
import { isInteractiveExperienceCompleted } from '@/features/home/continueJourney';
import { LEARNING_PATHS, pathProgress } from '@/features/learn/learningPaths';
import { usePathSignals } from '@/features/learn/usePathSignals';
import { useTrailSignals } from '@/features/trails/useTrailSignals';
import { useAllCultureItems } from '@/services/content/cultureItemsService';
import { useNetworkStatus } from '@/services/offline/networkStatus';
import { isRouteAvailableOffline } from '@/services/offline/offlineAvailability';
import { ownerDetective, useDetectiveStore } from '@/store/useDetectiveStore';
import { ownerMapChallenge, useMapChallengeStore } from '@/store/useMapChallengeStore';
import { useProgressStore } from '@/store/useProgressStore';
import { ownerRepeat, useRhythmRepeatStore } from '@/store/useRhythmRepeatStore';

import type { ChooserSignals } from './activityChooser';

const GAME_IDS: Record<string, string> = { jaaAtuu: 'jaa-atuu', kyzKuumai: 'kyz-kuumai', kokBoru: 'kok-boru' };

/** The same signals Home's recommendations read, shaped for the chooser. Local only. */
export function useActivityChooserSignals(): ChooserSignals {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { isOffline } = useNetworkStatus();
  const owner = useRecordsOwner();
  const { discovery } = useTodayDiscovery();
  const { completionFlags } = useTrailSignals();
  const { signals: pathSignals } = usePathSignals();
  const gameStats = useProgressStore((state) => state.gameStats);
  const detective = useDetectiveStore((state) => ownerDetective(state.saved, owner));
  const mapChallenge = useMapChallengeStore((state) => ownerMapChallenge(state.saved, owner));
  const repeat = useRhythmRepeatStore((state) => ownerRepeat(state.saved, owner));
  const { data: items } = useAllCultureItems();

  useEffect(() => {
    void useDetectiveStore.getState().load();
    void useMapChallengeStore.getState().load();
    void useRhythmRepeatStore.getState().load();
  }, []);

  return useMemo(() => {
    const tried = new Set<string>();
    for (const [id, gameId] of Object.entries(GAME_IDS)) if ((gameStats[progressGameIdFor(gameId)]?.played ?? 0) > 0) tried.add(id);
    if (isInteractiveExperienceCompleted('oymo', completionFlags)) tried.add('oymo');
    if (isInteractiveExperienceCompleted('boz-uy', completionFlags)) tried.add('bozUy');
    if (isInteractiveExperienceCompleted('shyrdak', completionFlags)) tried.add('shyrdak');
    if (detective.sessions > 0 || Object.keys(detective.expeditions ?? {}).length > 0) tried.add('detective');
    if (mapChallenge.sessions > 0) tried.add('mapChallenge');
    if (Object.values(repeat).some((entry) => (entry?.sessions ?? 0) > 0)) tried.add('repeatRhythm');
    const completed = new Set<string>();
    if (isInteractiveExperienceCompleted('komuz', completionFlags)) {
      completed.add('komuzLesson');
      tried.add('komuzLesson');
    }

    // The next READING step of a Learning Path already started (the chooser's Discover estimate is "one article").
    let pathStep: ChooserSignals['pathStep'] = null;
    for (const path of LEARNING_PATHS) {
      const progress = pathProgress(path, pathSignals);
      if (!progress.started || progress.done || progress.nextIndex === null) continue;
      const step = path.steps[progress.nextIndex];
      const item = step.type === 'culture_item' ? items?.find((row) => row.id === step.targetId) : null;
      if (item) {
        pathStep = { pathTitle: t(path.titleKey), itemTitle: item.title, route: `/culture/item/${item.id}` };
        break;
      }
    }

    return {
      isOffline,
      isAvailableOffline: (route: string) => isRouteAvailableOffline(route, queryClient),
      dailyDoneToday: !!discovery?.isCompleted,
      tried,
      completed,
      pathStep,
    };
  }, [isOffline, queryClient, discovery?.isCompleted, completionFlags, pathSignals, gameStats, detective, mapChallenge, repeat, items, t]);
}
