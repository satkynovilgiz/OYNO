import { ACTIVITY_CATALOG, type Activity } from '@/features/home/chooser/activityChooser';

/**
 * My Next Visit - a small PERSONAL plan of up to five things to do next
 * time: articles and activities from the existing registry. Not a Learning
 * Path (those are authored). Items are stored as stable ids, never URLs;
 * the route comes from the registry / the article route at display time.
 *
 * Opening an item only marks it "opened" - it is finished, skipped or kept
 * for later ONLY when the person says so. No time estimates (the chooser's
 * minutes are rough guesses, not reviewed metadata).
 */
export const MAX_ITEMS = 5;
export type ItemKind = 'article' | 'activity';
export type QueueItem = { kind: ItemKind; id: string; addedAt: string; openedAt: string | null; titleSnapshot: string };
export type Queue = QueueItem[];

export const itemKey = (item: Pick<QueueItem, 'kind' | 'id'>) => `${item.kind}:${item.id}`;
const ID = /^[A-Za-z0-9_-]{1,80}$/;

/** Registry activities that can be queued (fixed routes only; dynamic path steps are not activities). */
export const QUEUEABLE_ACTIVITIES: Activity[] = ACTIVITY_CATALOG.filter((activity) => activity.route.startsWith('/') && !activity.id.includes(':'));
export const activityFor = (id: string) => QUEUEABLE_ACTIVITIES.find((activity) => activity.id === id) ?? null;

export type Resolved = { route: string; title: string | null; titleKey: string | null } | null | undefined;
/**
 * Where an item opens, from stable data only. undefined = still loading
 * (articles), null = not available (unknown activity, removed article).
 */
export function resolveItem(item: Pick<QueueItem, 'kind' | 'id'>, article: (id: string) => { title: string } | null | undefined): Resolved {
  if (!ID.test(item.id)) return null;
  if (item.kind === 'activity') {
    const activity = activityFor(item.id);
    return activity ? { route: activity.route, title: activity.title ?? null, titleKey: activity.titleKey ?? null } : null;
  }
  const found = article(item.id);
  if (found === undefined) return undefined;
  return found ? { route: `/culture/item/${encodeURIComponent(item.id)}`, title: found.title, titleKey: null } : null;
}

export type QueueChange =
  | { type: 'add'; item: Pick<QueueItem, 'kind' | 'id' | 'titleSnapshot'>; now: string }
  | { type: 'remove'; key: string }
  | { type: 'move'; key: string; by: -1 | 1 }
  | { type: 'opened'; key: string; now: string }
  | { type: 'finish'; key: string }
  | { type: 'skip'; key: string }
  | { type: 'later'; key: string }
  | { type: 'clear' };

/** One change; returns the SAME array when nothing changes (or isn't allowed). */
export function applyQueueChange(queue: Queue, change: QueueChange): Queue {
  const index = 'key' in change ? queue.findIndex((item) => itemKey(item) === change.key) : -1;
  switch (change.type) {
    case 'add':
      if (queue.length >= MAX_ITEMS || !ID.test(change.item.id) || queue.some((item) => itemKey(item) === itemKey(change.item))) return queue;
      if (change.item.kind === 'activity' && !activityFor(change.item.id)) return queue;
      return [...queue, { kind: change.item.kind, id: change.item.id, titleSnapshot: change.item.titleSnapshot.slice(0, 160), addedAt: change.now, openedAt: null }];
    case 'remove':
    case 'finish':
    case 'skip':
      // Finishing and skipping take it off the plan; removing does too - only THIS item.
      return index < 0 ? queue : queue.filter((_, i) => i !== index);
    case 'move': {
      const target = index + change.by;
      if (index < 0 || target < 0 || target >= queue.length) return queue;
      const next = [...queue];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    }
    case 'opened':
      return index < 0 || queue[index].openedAt ? queue : queue.map((item, i) => (i === index ? { ...item, openedAt: change.now } : item));
    case 'later':
      // Back to the end of the plan, as not yet opened.
      return index < 0 ? queue : [...queue.filter((_, i) => i !== index), { ...queue[index], openedAt: null }];
    case 'clear':
      return queue.length ? [] : queue;
  }
}

export function normalizeQueue(raw: unknown): Queue {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Queue = [];
  for (const value of raw) {
    const v = value as Partial<QueueItem> | null;
    if (!v || (v.kind !== 'article' && v.kind !== 'activity') || typeof v.id !== 'string' || !ID.test(v.id)) continue;
    const key = itemKey(v as QueueItem);
    if (seen.has(key) || out.length >= MAX_ITEMS) continue;
    seen.add(key);
    out.push({ kind: v.kind, id: v.id, titleSnapshot: typeof v.titleSnapshot === 'string' ? v.titleSnapshot.slice(0, 160) : '', addedAt: typeof v.addedAt === 'string' ? v.addedAt : '', openedAt: typeof v.openedAt === 'string' ? v.openedAt : null });
  }
  return out;
}
