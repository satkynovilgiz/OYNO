/**
 * Overlapping mutations in the Reading Companion and Listening Notebook
 * stores, with DEFERRED storage writes: every write waits until the test
 * releases it, so two operations really are in flight at the same time.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { createSerialQueue } from '@/services/storage/serialWrites';

import { LISTENING_NOTEBOOK_KEY, ownerNotebook, useListeningNotebookStore } from './useListeningNotebookStore';
import { ownerBookmarks, SECTION_BOOKMARKS_KEY, useSectionBookmarksStore } from './useSectionBookmarksStore';

type Pending = { key: string; value: string; resolve: () => void; reject: (error: Error) => void };
let pending: Pending[] = [];
const realSetItem = AsyncStorage.setItem;
/** Writes stay pending until released (the real write happens on release). */
function deferWrites() {
  AsyncStorage.setItem = (key: string, value: string) =>
    new Promise<void>((resolve, reject) => {
      pending.push({ key, value, resolve: () => void realSetItem(key, value).then(resolve), reject });
    });
}
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
/** Releases writes one by one, in order, letting the queue start the next. */
async function releaseAll(fail: number[] = []) {
  for (let index = 0; pending.length || index < 20; index += 1) {
    await tick();
    const next = pending.shift();
    if (!next) {
      if (index > 5) break;
      continue;
    }
    if (fail.includes(index)) next.reject(new Error('disk full'));
    else next.resolve();
  }
  await tick();
}
const bookmark = (sectionKey: string, note = '') => ({ contentType: 'culture_item' as const, contentId: 'boz-uy-tunduk', sectionKey, articleTitle: 'T', sectionLabel: sectionKey, note });
const moment = (position: number) => ({ trackId: 'ak-maral-min', title: 'Ак марал мин', position, duration: 120 });
async function reloadBookmarks() {
  useSectionBookmarksStore.setState({ status: 'idle', saved: {} });
  await useSectionBookmarksStore.getState().load();
}
async function reloadNotebook() {
  useListeningNotebookStore.setState({ status: 'idle', saved: {} });
  await useListeningNotebookStore.getState().load();
}

beforeEach(async () => {
  AsyncStorage.setItem = realSetItem;
  pending = [];
  await AsyncStorage.clear();
  useSectionBookmarksStore.setState({ status: 'ready', saved: {} });
  useListeningNotebookStore.setState({ status: 'ready', saved: {} });
  deferWrites();
});
afterAll(() => {
  AsyncStorage.setItem = realSetItem;
});

it('1. two section bookmarks saved concurrently both survive a reload', async () => {
  const a = useSectionBookmarksStore.getState().save('user-a', bookmark('history', 'first'));
  const b = useSectionBookmarksStore.getState().save('user-a', bookmark('origin', 'second'));
  await releaseAll();
  expect(await Promise.all([a, b])).toEqual([true, true]);
  AsyncStorage.setItem = realSetItem;
  await reloadBookmarks();
  expect(Object.values(ownerBookmarks(useSectionBookmarksStore.getState().saved, 'user-a')).map((entry) => entry.sectionKey).sort()).toEqual(['history', 'origin']);
});

it('2. two listening moments captured concurrently both survive a reload', async () => {
  const a = useListeningNotebookStore.getState().capture('user-a', moment(10));
  const b = useListeningNotebookStore.getState().capture('user-a', moment(20));
  await releaseAll();
  const [first, second] = await Promise.all([a, b]);
  expect(first && second).toBeTruthy();
  AsyncStorage.setItem = realSetItem;
  await reloadNotebook();
  expect(Object.values(ownerNotebook(useListeningNotebookStore.getState().saved, 'user-a')).map((entry) => entry.seconds).sort((x, y) => x - y)).toEqual([10, 20]);
});

it('3. saving one record while deleting another: both changes survive', async () => {
  AsyncStorage.setItem = realSetItem;
  await useSectionBookmarksStore.getState().save('user-a', bookmark('history'));
  const old = await useListeningNotebookStore.getState().capture('user-a', moment(5));
  deferWrites();
  const save = useSectionBookmarksStore.getState().save('user-a', bookmark('origin'));
  const remove = useSectionBookmarksStore.getState().remove('user-a', 'culture_item:boz-uy-tunduk#history');
  const capture = useListeningNotebookStore.getState().capture('user-a', moment(50));
  const removeMoment = useListeningNotebookStore.getState().remove('user-a', old!.id);
  await releaseAll();
  expect(await Promise.all([save, remove, removeMoment])).toEqual([true, true, true]);
  expect(await capture).toBeTruthy();
  AsyncStorage.setItem = realSetItem;
  await reloadBookmarks();
  await reloadNotebook();
  expect(Object.keys(ownerBookmarks(useSectionBookmarksStore.getState().saved, 'user-a'))).toEqual(['culture_item:boz-uy-tunduk#origin']);
  expect(Object.values(ownerNotebook(useListeningNotebookStore.getState().saved, 'user-a')).map((entry) => entry.seconds)).toEqual([50]);
});

it('4. the first write fails: it reports failure and changes nothing; the next operation still succeeds', async () => {
  const failed = useSectionBookmarksStore.getState().save('user-a', bookmark('history', 'will fail'));
  const next = useSectionBookmarksStore.getState().save('user-a', bookmark('origin', 'goes through'));
  await releaseAll([0]);
  expect(await failed).toBe(false);
  expect(await next).toBe(true);
  AsyncStorage.setItem = realSetItem;
  await reloadBookmarks();
  expect(Object.values(ownerBookmarks(useSectionBookmarksStore.getState().saved, 'user-a')).map((entry) => entry.sectionKey)).toEqual(['origin']);
  // Nothing was retried by the queue: exactly the two writes were attempted.
  expect(pending).toHaveLength(0);
});

it('5. mutations for two owners in flight together: neither owner loses data', async () => {
  const a1 = useSectionBookmarksStore.getState().save('user-a', bookmark('history'));
  const b1 = useSectionBookmarksStore.getState().save('user-b', bookmark('origin'));
  const a2 = useListeningNotebookStore.getState().capture('user-a', moment(1));
  const b2 = useListeningNotebookStore.getState().capture('user-b', moment(2));
  await releaseAll();
  expect(await Promise.all([a1, b1])).toEqual([true, true]);
  expect((await a2) && (await b2)).toBeTruthy();
  AsyncStorage.setItem = realSetItem;
  await reloadBookmarks();
  await reloadNotebook();
  expect(Object.keys(ownerBookmarks(useSectionBookmarksStore.getState().saved, 'user-a'))).toEqual(['culture_item:boz-uy-tunduk#history']);
  expect(Object.keys(ownerBookmarks(useSectionBookmarksStore.getState().saved, 'user-b'))).toEqual(['culture_item:boz-uy-tunduk#origin']);
  expect(Object.values(ownerNotebook(useListeningNotebookStore.getState().saved, 'user-a')).map((entry) => entry.seconds)).toEqual([1]);
  expect(Object.values(ownerNotebook(useListeningNotebookStore.getState().saved, 'user-b')).map((entry) => entry.seconds)).toEqual([2]);
  expect(JSON.parse((await AsyncStorage.getItem(SECTION_BOOKMARKS_KEY)) ?? '{}')).toHaveProperty('user-a');
  expect(JSON.parse((await AsyncStorage.getItem(LISTENING_NOTEBOOK_KEY)) ?? '{}')).toHaveProperty('user-b');
});

it('the queue itself: order kept, a rejected task does not block the next, nothing is retried', async () => {
  AsyncStorage.setItem = realSetItem;
  const queue = createSerialQueue();
  const log: string[] = [];
  const first = queue(async () => {
    log.push('first');
    throw new Error('boom');
  });
  const second = queue(async () => {
    log.push('second');
    return 2;
  });
  await expect(first).rejects.toThrow('boom');
  await expect(second).resolves.toBe(2);
  expect(log).toEqual(['first', 'second']);
});
