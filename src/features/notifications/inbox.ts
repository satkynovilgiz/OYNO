import { localDateKey } from '@/services/daily/dailyDiscovery';

/**
 * OYNO's activity inbox - pure logic, no UI.
 *
 * Two sources, both real:
 *   LIVE items    computed from current state, only while actionable:
 *                 today's Daily OYNO (not yet completed), today's Daily Gift
 *                 (not yet claimed), the Daily Challenge (only once Daily
 *                 OYNO is done and the challenge isn't), an in-progress
 *                 Guided Trail. Their ids carry the date, so tomorrow's is a
 *                 new item and yesterday's never lingers.
 *   EVENTS        a small per-account log of things that actually happened:
 *                 achievement unlocked, download finished / failed,
 *                 challenge completed.
 *
 * Nothing here is marketing or engagement copy: every item has a real
 * cause and a real destination. Items carry ids and numbers only - never
 * user-written text (journal notes), emails, ids of the account, or paths.
 */
export type InboxType = 'daily' | 'gift' | 'challenge' | 'trail' | 'achievement' | 'download' | 'downloadFailed' | 'challengeDone';

export type ActivityEvent = {
  /** Stable, dedupe-safe id (e.g. `achievement:firstWin`). */
  id: string;
  type: Extract<InboxType, 'achievement' | 'download' | 'downloadFailed' | 'challengeDone'>;
  createdAt: string;
  /** Ids / numbers only. */
  params: Record<string, string | number>;
};

export type InboxItem = {
  id: string;
  type: InboxType;
  /** null for live items (they belong to "today" and show no clock time). */
  createdAt: string | null;
  params: Record<string, string | number>;
  route: string;
};

export const MAX_EVENTS = 50;

/** Adds an event unless one with the same id exists; newest first, capped. */
export function appendEvent(events: ActivityEvent[], event: ActivityEvent, cap = MAX_EVENTS): ActivityEvent[] {
  if (events.some((existing) => existing.id === event.id)) return events;
  return [event, ...events].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, cap);
}

export type LiveState = {
  now: Date;
  dailyAvailable: boolean;
  dailyCompleted: boolean;
  giftClaimedToday: boolean;
  dailyChallengeCompletedToday: boolean;
  activeTrail: { id: string; completed: number; total: number } | null;
};

export function buildLiveItems(state: LiveState): InboxItem[] {
  const day = localDateKey(state.now);
  const items: InboxItem[] = [];
  if (state.dailyAvailable && !state.dailyCompleted) items.push({ id: `daily:${day}`, type: 'daily', createdAt: null, params: {}, route: '/daily' });
  if (!state.giftClaimedToday) items.push({ id: `gift:${day}`, type: 'gift', createdAt: null, params: {}, route: '/home' });
  // Learn first, then test: offered only after today's Daily OYNO is done.
  if (state.dailyCompleted && !state.dailyChallengeCompletedToday) items.push({ id: `challenge:${day}`, type: 'challenge', createdAt: null, params: {}, route: '/challenges/daily' });
  if (state.activeTrail) {
    items.push({
      id: `trail:${state.activeTrail.id}:${day}`,
      type: 'trail',
      createdAt: null,
      params: { trailId: state.activeTrail.id, completed: state.activeTrail.completed, total: state.activeTrail.total },
      route: `/trails/${state.activeTrail.id}`,
    });
  }
  return items;
}

/** Where an event leads. Content that no longer exists is handled by the
 * destination's own not-found state (never a crash). */
export function routeForEvent(event: ActivityEvent): string {
  switch (event.type) {
    case 'achievement':
      return '/achievements';
    case 'download':
    case 'downloadFailed':
      return downloadRoute(String(event.params.kind), String(event.params.contentId));
    case 'challengeDone':
      return String(event.params.challengeKey).startsWith('daily') ? '/challenges' : `/challenges/${String(event.params.challengeKey).replace(':', '-')}`;
  }
}

function downloadRoute(kind: string, contentId: string): string {
  if (kind === 'nature') return `/explore/${contentId}`;
  if (kind === 'collection') return `/collections/${contentId}`;
  if (kind === 'culture_item') return `/culture/item/${contentId}`;
  return '/offline';
}

export function eventToItem(event: ActivityEvent): InboxItem {
  return { id: event.id, type: event.type, createdAt: event.createdAt, params: event.params, route: routeForEvent(event) };
}

/** Live items first (they are today's actions), then events newest first. */
export function mergeInbox(live: InboxItem[], events: ActivityEvent[], dismissedIds: string[] = []): InboxItem[] {
  const hidden = new Set(dismissedIds);
  return [...live, ...events.map(eventToItem)].filter((item) => !hidden.has(item.id));
}

export function unreadCount(items: InboxItem[], readIds: string[]): number {
  const read = new Set(readIds);
  return items.filter((item) => !read.has(item.id)).length;
}

export type InboxSectionId = 'today' | 'yesterday' | 'week' | 'earlier';

/** Today / Yesterday / This week (last 7 days) / Earlier, by local date. */
export function sectionFor(item: InboxItem, now: Date): InboxSectionId {
  if (!item.createdAt) return 'today';
  const created = new Date(item.createdAt);
  const today = localDateKey(now);
  const key = localDateKey(created);
  if (key === today) return 'today';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (key === localDateKey(yesterday)) return 'yesterday';
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  return created.getTime() >= weekAgo.getTime() ? 'week' : 'earlier';
}

export function groupInbox(items: InboxItem[], now: Date): { id: InboxSectionId; items: InboxItem[] }[] {
  const order: InboxSectionId[] = ['today', 'yesterday', 'week', 'earlier'];
  return order.map((id) => ({ id, items: items.filter((item) => sectionFor(item, now) === id) })).filter((section) => section.items.length > 0);
}

/** Only events that happen *while the user is here* become inbox items -
 * data restored by sync or loaded at start (old results, old downloads) is
 * not "news". */
export const FRESH_EVENT_WINDOW_MS = 10 * 60 * 1000;

export function isFresh(timestamp: string | null | undefined, now: Date): boolean {
  if (!timestamp) return false;
  const at = new Date(timestamp).getTime();
  return Number.isFinite(at) && now.getTime() - at >= -60_000 && now.getTime() - at <= FRESH_EVENT_WINDOW_MS;
}
