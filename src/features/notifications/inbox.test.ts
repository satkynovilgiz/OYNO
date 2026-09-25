import { appendEvent, buildLiveItems, groupInbox, isFresh, mergeInbox, routeForEvent, unreadCount, type ActivityEvent, type LiveState } from './inbox';

const NOW = new Date(2026, 8, 25, 18, 0, 0);
const base: LiveState = { now: NOW, dailyAvailable: true, dailyCompleted: false, giftClaimedToday: false, dailyChallengeCompletedToday: false, activeTrail: null };

function event(id: string, type: ActivityEvent['type'], createdAt: Date, params: ActivityEvent['params'] = {}): ActivityEvent {
  return { id, type, createdAt: createdAt.toISOString(), params };
}

describe('live inbox items', () => {
  it('shows only actionable, real state', () => {
    expect(buildLiveItems(base).map((item) => item.type)).toEqual(['daily', 'gift']);
  });

  it('drops Daily once completed and offers the Daily Challenge only then', () => {
    const types = buildLiveItems({ ...base, dailyCompleted: true }).map((item) => item.type);
    expect(types).toEqual(['gift', 'challenge']);
    expect(buildLiveItems({ ...base, dailyCompleted: true, dailyChallengeCompletedToday: true }).map((item) => item.type)).toEqual(['gift']);
  });

  it('never shows a claimed gift, and nothing when there is no Daily content', () => {
    expect(buildLiveItems({ ...base, dailyAvailable: false, giftClaimedToday: true })).toEqual([]);
  });

  it('uses date-scoped ids so tomorrow is a new item', () => {
    const today = buildLiveItems(base)[0].id;
    const tomorrow = buildLiveItems({ ...base, now: new Date(2026, 8, 26, 9) })[0].id;
    expect(today).toBe('daily:2026-09-25');
    expect(tomorrow).toBe('daily:2026-09-26');
  });

  it('links an active trail to that exact trail with its real counts', () => {
    const trail = buildLiveItems({ ...base, activeTrail: { id: 'horse-culture', completed: 1, total: 2 } }).find((item) => item.type === 'trail');
    expect(trail?.route).toBe('/trails/horse-culture');
    expect(trail?.params).toEqual({ trailId: 'horse-culture', completed: 1, total: 2 });
  });
});

describe('activity events', () => {
  it('dedupes by id and keeps newest first, capped', () => {
    const a = event('achievement:firstWin', 'achievement', new Date(2026, 8, 24));
    const b = event('download:nature:son-kol', 'download', new Date(2026, 8, 25));
    let log = appendEvent([], a);
    log = appendEvent(log, b);
    log = appendEvent(log, a);
    expect(log.map((e) => e.id)).toEqual([b.id, a.id]);
    const many = Array.from({ length: 60 }, (_, i) => event(`e${i}`, 'download', new Date(2026, 8, 1, 0, i)));
    expect(many.reduce((acc, e) => appendEvent(acc, e, 50), [] as ActivityEvent[])).toHaveLength(50);
  });

  it('maps every event to a real route', () => {
    expect(routeForEvent(event('x', 'achievement', NOW))).toBe('/achievements');
    expect(routeForEvent(event('x', 'download', NOW, { kind: 'nature', contentId: 'son-kol' }))).toBe('/explore/son-kol');
    expect(routeForEvent(event('x', 'downloadFailed', NOW, { kind: 'collection', contentId: 'boz-uy-world' }))).toBe('/collections/boz-uy-world');
    expect(routeForEvent(event('x', 'challengeDone', NOW, { challengeKey: 'collection:horse-culture' }))).toBe('/challenges/collection-horse-culture');
    expect(routeForEvent(event('x', 'challengeDone', NOW, { challengeKey: 'daily:2026-09-25' }))).toBe('/challenges');
  });

  it('treats only just-happened changes as news (not data restored by sync)', () => {
    expect(isFresh(new Date(NOW.getTime() - 60_000).toISOString(), NOW)).toBe(true);
    expect(isFresh(new Date(2026, 7, 1).toISOString(), NOW)).toBe(false);
    expect(isFresh(null, NOW)).toBe(false);
  });
});

describe('unread + grouping', () => {
  const items = mergeInbox(buildLiveItems(base), [
    event('a1', 'achievement', new Date(2026, 8, 25, 9)),
    event('d1', 'download', new Date(2026, 8, 24, 20), { kind: 'nature', contentId: 'alay' }),
    event('c1', 'challengeDone', new Date(2026, 8, 21, 12), { challengeKey: 'journey' }),
    event('o1', 'download', new Date(2026, 7, 1, 12), { kind: 'nature', contentId: 'alay' }),
  ]);

  it('counts unread from the same items the screen shows', () => {
    expect(unreadCount(items, [])).toBe(6);
    expect(unreadCount(items, ['daily:2026-09-25', 'a1'])).toBe(4);
  });

  it('groups into Today / Yesterday / This week / Earlier', () => {
    const groups = groupInbox(items, NOW);
    expect(groups.map((g) => g.id)).toEqual(['today', 'yesterday', 'week', 'earlier']);
    expect(groups[0].items.map((i) => i.id)).toEqual(['daily:2026-09-25', 'gift:2026-09-25', 'a1']);
  });

  it('hides dismissed items for good', () => {
    expect(mergeInbox([], [event('a1', 'achievement', NOW)], ['a1'])).toEqual([]);
  });
});
