import AsyncStorage from '@react-native-async-storage/async-storage';

import type { MotifLayer } from '@/services/culture/oymoEditor';
import { OYMO_MILESTONES_KEY, ownerMilestones, useOymoMilestonesStore } from '@/store/useOymoMilestonesStore';

import { addMilestone, compareSnapshots, MAX_OWNER_CHARS, MAX_PER_DESIGN, removeAllFor, removeMilestone, toCreatorCopy, type Snapshot } from './milestonesModel';

const layer = (id: string, change: Partial<MotifLayer> = {}): MotifLayer => ({ id, motifId: 'gul', color: '#2F5233', point: { x: 60, y: 100 }, rotation: 0, scale: 1, visible: true, ...change });
const snap = (layers: MotifLayer[] = [layer('layer0')], change: Partial<Snapshot> = {}): Snapshot => ({ layers, backgroundColor: '#EADCC0', symmetry: 'none', ...change });
const store = () => useOymoMilestonesStore.getState();
const T = '2026-10-12T00:00:00Z';

beforeEach(async () => {
  await AsyncStorage.clear();
  useOymoMilestonesStore.setState({ status: 'idle', saved: {} });
  await store().load();
});

describe('identity and deep copies', () => {
  it('identical designs with different creation ids have separate milestones', async () => {
    expect(await store().add('guest', 'creation-a', snap(), 'A', 'm1')).toBe('saved');
    expect(await store().add('guest', 'creation-b', snap(), 'B', 'm2')).toBe('saved');
    const mine = ownerMilestones(store().saved, 'guest');
    expect(mine['creation-a'].map((m) => m.label)).toEqual(['A']);
    expect(mine['creation-b'].map((m) => m.label)).toEqual(['B']);
    await store().remove('guest', 'creation-a', 'm1');
    expect(ownerMilestones(store().saved, 'guest')['creation-b']).toHaveLength(1);
  });
  it('the snapshot is a deep copy: later edits to the design do not change it', () => {
    const live = snap();
    const result = addMilestone({}, 'c1', live, '', T, 'm1');
    live.layers[0].point.x = 999;
    live.layers.push(layer('layer1'));
    expect(result.ok && result.milestone.snapshot.layers).toEqual([layer('layer0')]);
  });
  it('editing a restored copy does not alter the milestone', () => {
    const result = addMilestone({}, 'c1', snap(), '', T, 'm1');
    if (!result.ok) throw new Error('not added');
    const copy = toCreatorCopy(result.milestone);
    copy.state.layers[0].color = '#000000';
    copy.state.layers[0].point.y = 5;
    expect(result.milestone.snapshot.layers[0]).toEqual(layer('layer0'));
    expect(copy.state.nextId).toBe(1);
  });
});

describe('limits', () => {
  it(`at most ${MAX_PER_DESIGN} per design`, async () => {
    for (let i = 0; i < MAX_PER_DESIGN; i += 1) expect(await store().add('guest', 'c1', snap(), `#${i}`, `m${i}`)).toBe('saved');
    expect(await store().add('guest', 'c1', snap(), 'one more', 'mx')).toBe('limit');
    expect(await store().add('guest', 'c2', snap(), 'other design', 'my')).toBe('saved');
  });
  it('a total size limit per owner', () => {
    const big = snap(Array.from({ length: 200 }, (_, i) => layer(`layer${i}`, { motifId: 'kochkorMuyuz'.repeat(20) })));
    let all = {};
    let reason: string | null = null;
    for (let i = 0; i < 200 && !reason; i += 1) {
      const result = addMilestone(all, `c${Math.floor(i / 10)}`, big, '', T, `m${i}`);
      if (result.ok) all = result.next;
      else reason = result.reason;
    }
    expect(reason).toBe('size');
    expect(JSON.stringify(all).length).toBeLessThanOrEqual(MAX_OWNER_CHARS);
  });
  it('labels are short and cleaned', () => {
    const result = addMilestone({}, 'c1', snap(), '  <b>Before the border, with a very long label text</b> ', T, 'm1');
    expect(result.ok && result.milestone.label).toBe('bBefore the border, with a very long lab');
  });
});

describe('deletion', () => {
  it('deletes one milestone or all of a design', () => {
    let all = {};
    for (const id of ['m1', 'm2']) {
      const r = addMilestone(all, 'c1', snap(), '', T, id);
      if (r.ok) all = r.next;
    }
    const one = removeMilestone(all, 'c1', 'm1');
    expect((one as Record<string, unknown[]>).c1).toHaveLength(1);
    expect(removeMilestone(one, 'c1', 'm2')).toEqual({});
    expect(removeAllFor(all, 'c1')).toEqual({});
    expect(removeMilestone(all, 'c1', 'nope')).toBe(all);
  });
});

describe('writes and owners', () => {
  it('a failed write keeps nothing new and reports failure', async () => {
    const real = AsyncStorage.setItem;
    AsyncStorage.setItem = () => Promise.reject(new Error('disk full'));
    try {
      expect(await store().add('guest', 'c1', snap(), 'x', 'm1')).toBe('failed');
    } finally {
      AsyncStorage.setItem = real;
    }
    expect(ownerMilestones(store().saved, 'guest')).toEqual({});
  });
  it('delayed writes are serialized - both milestones land', async () => {
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
      const a = store().add('guest', 'c1', snap(), 'first', 'm1');
      const b = store().add('guest', 'c1', snap([layer('layer0'), layer('layer1')]), 'second', 'm2');
      release();
      expect(await Promise.all([a, b])).toEqual(['saved', 'saved']);
    } finally {
      AsyncStorage.setItem = real;
    }
    expect(JSON.parse((await AsyncStorage.getItem(OYMO_MILESTONES_KEY))!).guest.c1.map((m: { label: string }) => m.label)).toEqual(['first', 'second']);
  });
  it("another account sees none of the previous owner's milestones", async () => {
    await store().add('user-a', 'c1', snap(), 'mine', 'm1');
    expect(ownerMilestones(store().saved, 'user-b')).toEqual({});
  });
});

describe('comparison', () => {
  it('lists actual model changes by layer id', () => {
    const a = snap([layer('layer0'), layer('layer1', { motifId: 'muyuz' })]);
    const b = snap([layer('layer0', { point: { x: 80, y: 100 }, color: '#C0392B', rotation: 45, scale: 1.3 }), layer('layer2', { motifId: 'kyal' })], { backgroundColor: '#FFFFFF', symmetry: 'mirror' });
    expect(compareSnapshots(a, b).map((d) => d.kind)).toEqual(['added', 'moved', 'recoloured', 'turned', 'resized', 'removed', 'background', 'symmetry']);
    expect(compareSnapshots(a, a)).toEqual([]);
  });
});
