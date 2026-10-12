import AsyncStorage from '@react-native-async-storage/async-storage';

import { ownerTags, TAGS_KEY, useTagsStore } from '@/store/useTagsStore';

import { applyTagChange, EMPTY_TAGS, normalizeTags, sortedTags, tagsOf, TAG_TYPES, validRef, type OwnerTags, type RecordRef } from './tagsModel';

const q: RecordRef = { type: 'question', id: 'q-1' };
const sb: RecordRef = { type: 'scrapbook', id: 'sbtrip1' };
const note: RecordRef = { type: 'note', id: 'culture_item:boz-uy#history' };
const make = (...names: string[]) => names.reduce<OwnerTags>((d, name, i) => applyTagChange(d, { type: 'create', id: `t${i}`, name, now: 'T' }), EMPTY_TAGS);

describe('identity', () => {
  it('references are stable type + id; capsules are not a taggable type', () => {
    expect(validRef(note)).toBe(true);
    expect(validRef({ type: 'capsule', id: 'c1' })).toBe(false);
    expect(TAG_TYPES).not.toContain('capsule' as never);
    let d = make('Patterns');
    d = applyTagChange(d, { type: 'attach', id: 't0', ref: q });
    expect(applyTagChange(d, { type: 'attach', id: 't0', ref: { ...q } })).toBe(d); // no duplicate reference
    expect(tagsOf(d, q).map((t) => t.name)).toEqual(['Patterns']);
  });
  it('names are unique (case-insensitive) and cleaned', () => {
    const d = make('Patterns');
    expect(applyTagChange(d, { type: 'create', id: 'x', name: '  patterns ', now: 'T' })).toBe(d);
    expect(applyTagChange(d, { type: 'create', id: 'x', name: '   ', now: 'T' })).toBe(d);
    expect(sortedTags(make('  Music <b> ')).map((t) => t.name)).toEqual(['Music b']);
  });
});

describe('rename and merge', () => {
  it('rename changes the one tag every view reads from', () => {
    let d = make('Patterns', 'Music');
    d = applyTagChange(d, { type: 'attach', id: 't0', ref: q });
    d = applyTagChange(d, { type: 'rename', id: 't0', name: 'Ornaments' });
    expect(tagsOf(d, q).map((t) => t.name)).toEqual(['Ornaments']);
    expect(applyTagChange(d, { type: 'rename', id: 't0', name: 'music' })).toBe(d); // taken
  });
  it('merge moves references, removes duplicates and the merged tag; records untouched', () => {
    let d = make('A', 'B');
    for (const ref of [q, sb]) d = applyTagChange(d, { type: 'attach', id: 't0', ref });
    for (const ref of [q, note]) d = applyTagChange(d, { type: 'attach', id: 't1', ref });
    d = applyTagChange(d, { type: 'merge', from: 't0', into: 't1' });
    expect(Object.keys(d.tags)).toEqual(['t1']);
    expect(d.refs.t1).toEqual([q, note, sb]);
    expect(applyTagChange(d, { type: 'merge', from: 't1', into: 't1' })).toBe(d);
  });
  it('deleting a tag removes only the tag and its references', () => {
    let d = make('A', 'B');
    d = applyTagChange(d, { type: 'attach', id: 't0', ref: q });
    d = applyTagChange(d, { type: 'attach', id: 't1', ref: q });
    d = applyTagChange(d, { type: 'delete', id: 't0' });
    expect(Object.keys(d.tags)).toEqual(['t1']);
    expect(tagsOf(d, q).map((t) => t.name)).toEqual(['B']);
  });
});

describe('missing records and stored data', () => {
  it('a reference to a missing record stays until removed; removing affects only it', () => {
    let d = make('A');
    for (const ref of [q, { type: 'question' as const, id: 'gone' }]) d = applyTagChange(d, { type: 'attach', id: 't0', ref });
    d = applyTagChange(d, { type: 'detach', id: 't0', ref: { type: 'question', id: 'gone' } });
    expect(d.refs.t0).toEqual([q]);
  });
  it('normalizes stored data: bad tags, refs and duplicates dropped', () => {
    const d = normalizeTags({ tags: { t0: { id: 't0', name: 'A' }, bad: { id: 'other', name: 'B' } }, refs: { t0: [q, q, { type: 'capsule', id: 'c' }, { type: 'question', id: '' }] } });
    expect(Object.keys(d.tags)).toEqual(['t0']);
    expect(d.refs.t0).toEqual([q]);
  });
});

describe('store: ownership and failures', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useTagsStore.setState({ status: 'idle', saved: {} });
    await useTagsStore.getState().load();
  });
  it("tags are per owner - another account never sees them", async () => {
    await useTagsStore.getState().change('user-a', { type: 'create', id: 't0', name: 'Mine', now: 'T' });
    expect(sortedTags(ownerTags(useTagsStore.getState().saved, 'user-b'))).toEqual([]);
    expect(await useTagsStore.getState().change('user-b', { type: 'rename', id: 't0', name: 'Stolen' })).toBe(false);
    expect(sortedTags(ownerTags(useTagsStore.getState().saved, 'user-a'))[0].name).toBe('Mine');
  });
  it('a failed write is not shown; an unreadable store blocks writes', async () => {
    const real = AsyncStorage.setItem;
    AsyncStorage.setItem = () => Promise.reject(new Error('disk'));
    try {
      expect(await useTagsStore.getState().change('guest', { type: 'create', id: 't0', name: 'A', now: 'T' })).toBe(false);
    } finally {
      AsyncStorage.setItem = real;
    }
    expect(sortedTags(ownerTags(useTagsStore.getState().saved, 'guest'))).toEqual([]);
    await AsyncStorage.setItem(TAGS_KEY, '{x');
    useTagsStore.setState({ status: 'idle', saved: {} });
    await useTagsStore.getState().load();
    expect(useTagsStore.getState().status).toBe('error');
    expect(await useTagsStore.getState().change('guest', { type: 'create', id: 't0', name: 'A', now: 'T' })).toBe(false);
  });
});
