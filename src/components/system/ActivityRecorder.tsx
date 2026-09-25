import { useEffect } from 'react';

import { isFresh } from '@/features/notifications/inbox';
import { useOfflineStore } from '@/services/offline/useOfflineStore';
import { useActivityStore } from '@/store/useActivityStore';
import { useChallengeStore } from '@/store/useChallengeStore';
import { useProgressStore } from '@/store/useProgressStore';

/**
 * Turns real, just-happened app events into inbox entries - without
 * touching the stores that own them (read-only subscriptions):
 *
 *   achievement unlocked   progress.lastUnlockedAchievementId becomes set
 *   download finished      a new id appears in the offline manifest
 *   download failed        a new id appears in `failed` that has no copy yet
 *                          (a failed *refresh* keeps the old copy -> not news)
 *   challenge completed    a result's completedAt changes to "just now"
 *
 * Loading stored data or merging synced data never creates entries: every
 * check requires both states to be loaded and the change to be fresh.
 * Only ids and numbers are recorded - never user text.
 */
export function ActivityRecorder() {
  useEffect(() => {
    const record = useActivityStore.getState().record;
    const nowIso = () => new Date().toISOString();

    const unsubProgress = useProgressStore.subscribe((state, prev) => {
      const id = state.lastUnlockedAchievementId;
      if (id && id !== prev.lastUnlockedAchievementId) record({ id: `achievement:${id}`, type: 'achievement', createdAt: nowIso(), params: { achievementId: id } });
    });

    const unsubOffline = useOfflineStore.subscribe((state, prev) => {
      if (!state.isLoaded || !prev.isLoaded) return;
      for (const key of Object.keys(state.manifest.entries)) {
        if (prev.manifest.entries[key]) continue;
        const [kind, contentId] = key.split(':');
        record({ id: `download:${key}:${Date.now()}`, type: 'download', createdAt: nowIso(), params: { kind, contentId } });
      }
      for (const key of state.failed) {
        if (prev.failed.includes(key) || state.manifest.entries[key]) continue;
        const [kind, contentId] = key.split(':');
        record({ id: `downloadFailed:${key}:${Date.now()}`, type: 'downloadFailed', createdAt: nowIso(), params: { kind, contentId } });
      }
    });

    const unsubChallenges = useChallengeStore.subscribe((state, prev) => {
      if (!state.isLoaded || !prev.isLoaded) return;
      const now = new Date();
      for (const [key, result] of Object.entries(state.results)) {
        if (!result.completedAt || result.completedAt === prev.results[key]?.completedAt || !isFresh(result.completedAt, now)) continue;
        record({
          id: `challengeDone:${key}:${result.completedAt}`,
          type: 'challengeDone',
          createdAt: result.completedAt,
          params: { challengeKey: key, correct: result.lastCorrect, total: result.lastTotal },
        });
      }
    });

    return () => {
      unsubProgress();
      unsubOffline();
      unsubChallenges();
    };
  }, []);

  return null;
}
