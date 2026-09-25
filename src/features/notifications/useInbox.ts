import { useEffect, useMemo } from 'react';

import { useTodayDiscovery } from '@/features/daily/useTodayDiscovery';
import { computeTrailProgress } from '@/features/trails/trailProgress';
import { trails } from '@/features/trails/trailsData';
import { useTrailSignals } from '@/features/trails/useTrailSignals';
import { localDateKey } from '@/services/daily/dailyDiscovery';
import { useActivityStore } from '@/store/useActivityStore';
import { useChallengeStore } from '@/store/useChallengeStore';
import { useNotificationsStore } from '@/store/useNotificationsStore';
import { useProgressStore } from '@/store/useProgressStore';

import { buildLiveItems, mergeInbox, unreadCount, type InboxItem } from './inbox';

/** The inbox as the screen and the Home bell both see it. */
export function useInbox(): { items: InboxItem[]; unread: number; readIds: string[]; isLoaded: boolean } {
  const { discovery, isLoading } = useTodayDiscovery();
  const giftClaimedDate = useProgressStore((state) => state.dailyGiftClaimedDateISO);
  const challengeResults = useChallengeStore((state) => state.results);
  const trailSignals = useTrailSignals();
  const events = useActivityStore((state) => state.events);
  const readIds = useNotificationsStore((state) => state.readIds);
  const readLoaded = useNotificationsStore((state) => state.isLoaded);
  const eventsLoaded = useActivityStore((state) => state.isLoaded);

  useEffect(() => {
    if (!useNotificationsStore.getState().isLoaded) void useNotificationsStore.getState().load();
    if (!useActivityStore.getState().isLoaded) void useActivityStore.getState().load();
    if (!useChallengeStore.getState().isLoaded) void useChallengeStore.getState().load();
  }, []);

  const today = localDateKey();
  const items = useMemo(() => {
    const active = trails.map((trail) => ({ trail, progress: computeTrailProgress(trail, trailSignals) })).find((entry) => entry.progress.status === 'inProgress');
    const live = buildLiveItems({
      now: new Date(),
      dailyAvailable: !isLoading && !!discovery,
      dailyCompleted: !!discovery?.isCompleted,
      // Same "today" rule Home uses for the gift (UTC date of the claim).
      giftClaimedToday: giftClaimedDate === new Date().toISOString().slice(0, 10),
      dailyChallengeCompletedToday: !!challengeResults[`daily:${today}`]?.completedAt,
      activeTrail: active ? { id: active.trail.id, completed: active.progress.completed, total: active.progress.total } : null,
    });
    return mergeInbox(live, events);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discovery, isLoading, giftClaimedDate, challengeResults, trailSignals, events, today]);

  return { items, unread: unreadCount(items, readIds), readIds, isLoaded: readLoaded && eventsLoaded };
}
