import fs from 'fs';
import path from 'path';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { NEXT_VISIT_KEY, ownerQueue, useNextVisitStore } from '@/store/useNextVisitStore';

import { applyQueueChange, itemKey, MAX_ITEMS, normalizeQueue, QUEUEABLE_ACTIVITIES, resolveItem, type Queue } from './nextVisitModel';

const T = '2026-10-12T10:00:00.000Z';
const add = (queue: Queue, kind: 'article' | 'activity', id: string) => applyQueueChange(queue, { type: 'add', item: { kind, id, titleSnapshot: id }, now: T });
const keys = (queue: Queue) => queue.map(itemKey);
const store = () => useNextVisitStore.getState();

describe('route validation', () => {
  const appDir = path.join(__dirname, '..', '..', 'app');
  const routeExists = (route: string) => {
    const base = path.join(appDir, route.split('?')[0]);
    return fs.existsSync(`${base}.tsx`) || fs.existsSync(path.join(base, 'index.tsx'));
  };
  it('every queueable activity opens an existing app route', () => {
    expect(QUEUEABLE_ACTIVITIES.length).toBeGreaterThan(5);
    for (const activity of QUEUEABLE_ACTIVITIES) expect([activity.id, routeExists(activity.route)]).toEqual([activity.id, true]);
  });
  it('articles open the article route; ids, never URLs, are stored', () => {
    expect(resolveItem({ kind: 'article', id: 'boz-uy-overview' }, () => ({ title: 'Боз үй' }))).toEqual({ route: '/culture/item/boz-uy-overview', title: 'Боз үй', titleKey: null });
    expect(fs.existsSync(path.join(appDir, 'culture', 'item', '[itemId]', 'index.tsx'))).toBe(true);
    expect(add([], 'article', '/culture/item/x?evil=1')).toEqual([]);
    expect(add([], 'activity', 'notAnActivity')).toEqual([]);
  });
  it('unknown activities and removed articles resolve to "unavailable"; loading stays loading', () => {
    expect(resolveItem({ kind: 'activity', id: 'gone' }, () => null)).toBeNull();
    expect(resolveItem({ kind: 'article', id: 'gone' }, () => null)).toBeNull();
    expect(resolveItem({ kind: 'article', id: 'x' }, () => undefined)).toBeUndefined();
  });
});

describe('queue rules', () => {
  it('up to five, no duplicates, in the order added', () => {
    let queue: Queue = [];
    for (const id of ['detective', 'jaaAtuu', 'bozUy', 'komuzListen', 'restore', 'duel']) queue = add(queue, 'activity', id);
    expect(queue).toHaveLength(MAX_ITEMS);
    expect(add(queue, 'article', 'x')).toBe(queue);
    expect(add([{ ...queue[0] }], 'activity', 'detective')).toHaveLength(1);
  });
  it('reorder within bounds', () => {
    const queue = add(add(add([], 'activity', 'detective'), 'activity', 'jaaAtuu'), 'article', 'boz-uy');
    expect(keys(applyQueueChange(queue, { type: 'move', key: 'article:boz-uy', by: -1 }))).toEqual(['activity:detective', 'article:boz-uy', 'activity:jaaAtuu']);
    expect(applyQueueChange(queue, { type: 'move', key: 'activity:detective', by: -1 })).toBe(queue);
  });
  it('opening only marks opened - never finished', () => {
    const queue = add([], 'activity', 'detective');
    const opened = applyQueueChange(queue, { type: 'opened', key: 'activity:detective', now: T });
    expect(opened).toEqual([{ ...queue[0], openedAt: T }]);
    expect(applyQueueChange(opened, { type: 'opened', key: 'activity:detective', now: 'later' })).toBe(opened);
  });
  it('completion choices: finished / skip take it off; keep for later moves it to the end, unopened', () => {
    let queue = add(add(add([], 'activity', 'detective'), 'activity', 'jaaAtuu'), 'activity', 'bozUy');
    queue = applyQueueChange(queue, { type: 'opened', key: 'activity:detective', now: T });
    const later = applyQueueChange(queue, { type: 'later', key: 'activity:detective' });
    expect(keys(later)).toEqual(['activity:jaaAtuu', 'activity:bozUy', 'activity:detective']);
    expect(later[2].openedAt).toBeNull();
    expect(keys(applyQueueChange(queue, { type: 'finish', key: 'activity:detective' }))).toEqual(['activity:jaaAtuu', 'activity:bozUy']);
    expect(keys(applyQueueChange(queue, { type: 'skip', key: 'activity:jaaAtuu' }))).toEqual(['activity:detective', 'activity:bozUy']);
  });
  it('removing a missing item leaves the others', () => {
    const queue: Queue = normalizeQueue([{ kind: 'article', id: 'removed-article', titleSnapshot: 'Old', addedAt: T, openedAt: null }, { kind: 'activity', id: 'detective', titleSnapshot: '', addedAt: T, openedAt: null }]);
    expect(keys(applyQueueChange(queue, { type: 'remove', key: 'article:removed-article' }))).toEqual(['activity:detective']);
  });
  it('normalizes stored data: bad, duplicate and excess entries dropped', () => {
    const raw = [{ kind: 'url', id: 'x' }, { kind: 'activity', id: 'detective' }, { kind: 'activity', id: 'detective' }, ...['a', 'b', 'c', 'd', 'e'].map((id) => ({ kind: 'article', id }))];
    expect(keys(normalizeQueue(raw))).toEqual(['activity:detective', 'article:a', 'article:b', 'article:c', 'article:d']);
  });
});

describe('store', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useNextVisitStore.setState({ status: 'idle', saved: {} });
    await store().load();
  });
  const addTo = (owner: string, id: string) => store().change(owner, { type: 'add', item: { kind: 'activity', id, titleSnapshot: id }, now: T });
  it('persists across a restart, in order, with opened state', async () => {
    await addTo('guest', 'detective');
    await addTo('guest', 'jaaAtuu');
    await store().change('guest', { type: 'opened', key: 'activity:detective', now: T });
    useNextVisitStore.setState({ status: 'idle', saved: {} });
    await store().load();
    expect(ownerQueue(store().saved, 'guest').map((item) => [itemKey(item), item.openedAt])).toEqual([['activity:detective', T], ['activity:jaaAtuu', null]]);
  });
  it('is owner-scoped', async () => {
    await addTo('user-a', 'detective');
    expect(ownerQueue(store().saved, 'user-b')).toEqual([]);
  });
  it('a failed change does not appear saved', async () => {
    await addTo('guest', 'detective');
    const real = AsyncStorage.setItem;
    AsyncStorage.setItem = () => Promise.reject(new Error('disk full'));
    try {
      expect(await store().change('guest', { type: 'finish', key: 'activity:detective' })).toBe(false);
      expect(await addTo('guest', 'jaaAtuu')).toBe(false);
    } finally {
      AsyncStorage.setItem = real;
    }
    expect(ownerQueue(store().saved, 'guest').map(itemKey)).toEqual(['activity:detective']);
  });
  it('an add that cannot happen reports false; an unreadable store blocks writes', async () => {
    expect(await addTo('guest', 'notAnActivity')).toBe(false);
    await AsyncStorage.setItem(NEXT_VISIT_KEY, 'not json');
    useNextVisitStore.setState({ status: 'idle', saved: {} });
    await store().load();
    expect(store().status).toBe('error');
    expect(await addTo('guest', 'detective')).toBe(false);
  });
  it('serializes delayed writes', async () => {
    const real = AsyncStorage.setItem;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let first = true;
    AsyncStorage.setItem = async (key, value) => {
      if (first) {
        first = false;
        await gate;
      }
      return real(key, value);
    };
    try {
      const a = addTo('guest', 'detective');
      const b = addTo('guest', 'jaaAtuu');
      release();
      expect(await Promise.all([a, b])).toEqual([true, true]);
    } finally {
      AsyncStorage.setItem = real;
    }
    expect(ownerQueue(store().saved, 'guest').map(itemKey)).toEqual(['activity:detective', 'activity:jaaAtuu']);
  });
});
