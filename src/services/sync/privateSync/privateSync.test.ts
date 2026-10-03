/**
 * Private Cloud Sync, end to end: the REAL stores + runner against an
 * in-memory fake of user_state_records / push_user_state() that mirrors
 * the SQL (compare-and-swap revisions, tombstones, per-user rows). Two
 * "devices" are simulated by wiping local storage + store state while the
 * fake account backend stays.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onlineManager } from '@tanstack/react-query';
import * as fs from 'fs';
import * as path from 'path';

import * as client from '@/services/supabase/client';
import { track } from '@/services/analytics/analytics';
import { useChallengeMistakesStore } from '@/store/useChallengeMistakesStore';
import { useGameRecordsStore } from '@/store/useGameRecordsStore';
import { useGlossaryStudyStore } from '@/store/useGlossaryStudyStore';
import { useHighlightsStore } from '@/store/useHighlightsStore';
import { useKomuzLibraryStore } from '@/store/useKomuzLibraryStore';
import { useLearningPathStore } from '@/store/useLearningPathStore';
import { useListeningStore } from '@/store/useListeningStore';
import { ownerCollections, useMyCollectionsStore } from '@/store/useMyCollectionsStore';
import { useReadingStore } from '@/store/useReadingStore';
import { useWeeklyGoalStore } from '@/store/useWeeklyGoalStore';

import { bumpAccountGeneration, captureAccountGeneration } from '../accountGeneration';
import { collectionRules, glossaryStudyRules, mistakeRules, readingRules } from './domains';
import { forgetPrivateState, hasUnsyncedPrivateState, syncPrivateState, usePrivateSyncStatus, __resetPrivateSyncForTests } from './privateSync';
import { reconcile } from './reconcile';
import type { FakeStateBackend } from './testing/fakeStateBackend';

const mockAuth: { status: string; user: { id: string } | null } = { status: 'guest', user: null };

jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: { getState: () => mockAuth },
  registerAccountHooks: jest.fn(),
}));
jest.mock('@/services/analytics/analytics', () => ({ track: jest.fn() }));
jest.mock('@/services/supabase/client', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const state = (require('./testing/fakeStateBackend') as typeof import('./testing/fakeStateBackend')).createFakeStateBackend();
  return {
    __state: state,
    supabase: {
      from: () => state.query(mockAuth.user!.id),
      rpc: (fn: string, args: Record<string, unknown>) => Promise.resolve(fn === 'push_user_state' ? state.push(mockAuth.user!.id, args.p_domain as string, args.p_items as never) : { data: null, error: null }),
    },
  };
});

const backend = (client as unknown as { __state: FakeStateBackend }).__state;

function signInAs(userId: string) {
  mockAuth.status = 'authenticated';
  mockAuth.user = { id: userId };
  bumpAccountGeneration();
}
function signOut() {
  mockAuth.status = 'guest';
  mockAuth.user = null;
  bumpAccountGeneration();
}

/** A different phone: nothing local, same account backend. */
async function newDevice() {
  await AsyncStorage.clear();
  for (const store of [useReadingStore, useHighlightsStore, useMyCollectionsStore, useChallengeMistakesStore, useGameRecordsStore, useKomuzLibraryStore, useLearningPathStore, useListeningStore, useWeeklyGoalStore]) {
    (store as unknown as { setState: (state: object) => void }).setState({ saved: {}, isLoaded: false });
  }
  useGlossaryStudyStore.setState({ saved: {}, sessions: {}, isLoaded: false });
  __resetPrivateSyncForTests();
  for (const store of [useReadingStore, useHighlightsStore, useMyCollectionsStore, useChallengeMistakesStore, useGameRecordsStore, useKomuzLibraryStore, useLearningPathStore, useListeningStore, useWeeklyGoalStore, useGlossaryStudyStore]) {
    await (store.getState() as { load: () => Promise<void> }).load();
  }
}

/** Keeps a device's local storage aside so tests can switch back to it. */
async function snapshotDevice(): Promise<Record<string, string | null>> {
  const keys = await AsyncStorage.getAllKeys();
  return Object.fromEntries(await AsyncStorage.multiGet(keys));
}
async function restoreDevice(saved: Record<string, string | null>) {
  await AsyncStorage.clear();
  for (const [key, value] of Object.entries(saved)) if (value !== null) await AsyncStorage.setItem(key, value);
  for (const store of [useReadingStore, useHighlightsStore, useMyCollectionsStore, useChallengeMistakesStore, useGameRecordsStore, useKomuzLibraryStore, useLearningPathStore, useListeningStore, useWeeklyGoalStore]) {
    (store as unknown as { setState: (state: object) => void }).setState({ saved: {}, isLoaded: false });
  }
  useGlossaryStudyStore.setState({ saved: {}, sessions: {}, isLoaded: false });
  __resetPrivateSyncForTests();
  for (const store of [useReadingStore, useHighlightsStore, useMyCollectionsStore, useChallengeMistakesStore, useGameRecordsStore, useKomuzLibraryStore, useLearningPathStore, useListeningStore, useWeeklyGoalStore, useGlossaryStudyStore]) {
    await (store.getState() as { load: () => Promise<void> }).load();
  }
}

const sync = () => syncPrivateState(captureAccountGeneration());
const settle = () => new Promise((resolve) => setTimeout(resolve, 450));

beforeEach(async () => {
  jest.useRealTimers();
  backend.rows.clear();
  backend.fail = false;
  backend.pushes = 0;
  (track as jest.Mock).mockClear();
  onlineManager.setOnline(true);
  signOut();
  await newDevice();
});

const HIGHLIGHT = { contentType: 'culture_item' as const, contentId: 'boz-uy-overview', sectionKey: 'history', language: 'en', title: 'Boz Üy', text: 'The tunduk crowns the yurt.' };

describe('first device upload + second device hydrate', () => {
  it('uploads a signed-in account’s private data and restores it on a fresh device', async () => {
    signInAs('user-a');
    useReadingStore.getState().markRead('user-a', 'culture_item', 'boz-uy-overview');
    const { highlight } = useHighlightsStore.getState().save('user-a', HIGHLIGHT);
    useHighlightsStore.getState().setNote('user-a', highlight.id, 'My private thought');
    const collection = useMyCollectionsStore.getState().create('user-a', { name: 'Yurts' });
    useMyCollectionsStore.getState().add('user-a', collection.id, 'culture_item', 'boz-uy-overview');
    useGlossaryStudyStore.getState().answer('user-a', 'tunduk', 'review_again');
    useWeeklyGoalStore.getState().setGoal('user-a', 5);
    useKomuzLibraryStore.getState().toggleFavorite('user-a', 'chon-kerbez');
    useLearningPathStore.getState().setManual('user-a', 'boz-uy', 'builder', true);
    await sync();

    const rows = [...(backend.rows.get('user-a')?.values() ?? [])];
    expect(rows.map((row) => row.domain).sort()).toEqual(['collections', 'glossary_study', 'highlights', 'komuz_favorites', 'path_steps', 'reading', 'weekly_goal']);
    expect(usePrivateSyncStatus.getState().state).toBe('synced');

    await newDevice();
    signInAs('user-a');
    await sync();
    expect(useReadingStore.getState().saved['user-a']['culture_item:boz-uy-overview'].completedAt).toBeTruthy();
    expect(useHighlightsStore.getState().saved['user-a'][highlight.id].note).toBe('My private thought');
    expect(ownerCollections(useMyCollectionsStore.getState().saved, 'user-a').items.map((item) => item.contentId)).toEqual(['boz-uy-overview']);
    expect(useGlossaryStudyStore.getState().saved['user-a'].tunduk.needsReview).toBe(true);
    expect(useWeeklyGoalStore.getState().saved['user-a'].goal).toBe(5);
    expect(useKomuzLibraryStore.getState().saved['user-a'].favorites).toEqual(['chon-kerbez']);
    expect(useLearningPathStore.getState().saved['user-a']['boz-uy'].builder).toBeTruthy();
  });

  it('a second sync with nothing new writes nothing (idempotent)', async () => {
    signInAs('user-a');
    useReadingStore.getState().markRead('user-a', 'culture_item', 'boz-uy-overview');
    await sync();
    const pushes = backend.pushes;
    await sync();
    await sync();
    expect(backend.pushes).toBe(pushes);
  });
});

describe('merge, never blind overwrite', () => {
  it('first sign-in on device B merges with device A instead of replacing it', async () => {
    signInAs('user-a');
    useReadingStore.getState().record('user-a', 'culture_item', 'boz-uy-overview', 0.4);
    useMyCollectionsStore.getState().create('user-a', { name: 'From A' });
    await sync();
    const deviceA = await snapshotDevice();

    await newDevice();
    signInAs('user-a');
    useReadingStore.getState().record('user-a', 'culture_item', 'boz-uy-overview', 0.7);
    useReadingStore.getState().record('user-a', 'culture_item', 'oymo-overview', 0.2);
    useMyCollectionsStore.getState().create('user-a', { name: 'From B' });
    await sync();

    const reading = useReadingStore.getState().saved['user-a'];
    expect(reading['culture_item:boz-uy-overview'].furthest).toBe(0.7);
    expect(reading['culture_item:oymo-overview']).toBeTruthy();
    expect(ownerCollections(useMyCollectionsStore.getState().saved, 'user-a').collections.map((c) => c.name).sort()).toEqual(['From A', 'From B']);

    await restoreDevice(deviceA);
    signInAs('user-a');
    await sync();
    expect(ownerCollections(useMyCollectionsStore.getState().saved, 'user-a').collections.map((c) => c.name).sort()).toEqual(['From A', 'From B']);
    expect(useReadingStore.getState().saved['user-a']['culture_item:boz-uy-overview'].furthest).toBe(0.7);
  });

  it('conflicting glossary edits add up without double counting; newest action decides needsReview', async () => {
    signInAs('user-a');
    useGlossaryStudyStore.getState().answer('user-a', 'tunduk', 'got_it'); // seen 1
    await sync();
    const deviceA = await snapshotDevice();

    await newDevice();
    signInAs('user-a');
    await sync();
    useGlossaryStudyStore.getState().answer('user-a', 'tunduk', 'got_it'); // B: +1
    await sync();

    await restoreDevice(deviceA);
    signInAs('user-a');
    await new Promise((resolve) => setTimeout(resolve, 5));
    useGlossaryStudyStore.getState().answer('user-a', 'tunduk', 'review_again'); // A: +1, newest
    await sync();
    const record = useGlossaryStudyStore.getState().saved['user-a'].tunduk;
    expect(record.seenCount).toBe(3);
    expect(record.gotItCount).toBe(2);
    expect(record.reviewAgainCount).toBe(1);
    expect(record.needsReview).toBe(true);
  });

  it('a note edited on two phones keeps the newer edit', async () => {
    signInAs('user-a');
    const { highlight } = useHighlightsStore.getState().save('user-a', HIGHLIGHT);
    await sync();
    const deviceA = await snapshotDevice();

    await newDevice();
    signInAs('user-a');
    await sync();
    useHighlightsStore.getState().setNote('user-a', highlight.id, 'older note from B');
    await sync();

    await restoreDevice(deviceA);
    signInAs('user-a');
    await new Promise((resolve) => setTimeout(resolve, 5));
    useHighlightsStore.getState().setNote('user-a', highlight.id, 'newer note from A');
    await sync();
    expect(useHighlightsStore.getState().saved['user-a'][highlight.id].note).toBe('newer note from A');
  });
});

describe('offline first', () => {
  it('local edits work offline and are sent once the connection returns', async () => {
    signInAs('user-a');
    onlineManager.setOnline(false);
    useMyCollectionsStore.getState().create('user-a', { name: 'Offline' });
    useChallengeMistakesStore.getState().recordAttempt('user-a', ['q-1']);
    await expect(sync()).rejects.toBeTruthy();
    expect(usePrivateSyncStatus.getState().state).toBe('offline');
    expect(ownerCollections(useMyCollectionsStore.getState().saved, 'user-a').collections).toHaveLength(1);
    expect(backend.rows.get('user-a')).toBeUndefined();
    expect(await hasUnsyncedPrivateState('user-a')).toBe(true);

    onlineManager.setOnline(true);
    await sync();
    expect([...backend.rows.get('user-a')!.values()].map((row) => row.domain).sort()).toEqual(['collections', 'mistakes']);
    expect(await hasUnsyncedPrivateState('user-a')).toBe(false);
  });

  it('a failing server keeps local data and reports a sync issue (no exception leaks to the UI)', async () => {
    signInAs('user-a');
    useReadingStore.getState().markRead('user-a', 'culture_item', 'boz-uy-overview');
    backend.fail = true;
    await expect(sync()).rejects.toBeTruthy();
    expect(usePrivateSyncStatus.getState().state).toBe('error');
    expect(useReadingStore.getState().saved['user-a']['culture_item:boz-uy-overview']).toBeTruthy();
    backend.fail = false;
    await sync();
    expect(usePrivateSyncStatus.getState().state).toBe('synced');
  });

  it('migration not applied yet: "not available", not a failure - local data stays and is never forgotten', async () => {
    signInAs('user-a');
    useReadingStore.getState().markRead('user-a', 'culture_item', 'boz-uy-overview');
    backend.fail = 'missing';
    await expect(sync()).resolves.toEqual({ conflicts: 0 });
    expect(usePrivateSyncStatus.getState().state).toBe('idle');
    expect(usePrivateSyncStatus.getState().syncedOwners['user-a']).toBeUndefined();
    expect(useReadingStore.getState().saved['user-a']['culture_item:boz-uy-overview']).toBeTruthy();
    // Sign-out must keep it on the device (nothing reached the account).
    expect(await hasUnsyncedPrivateState('user-a')).toBe(true);
  });

  it('a push whose response was lost is retried safely (no duplicate, no endless retry)', async () => {
    signInAs('user-a');
    useLearningPathStore.getState().setManual('user-a', 'boz-uy', 'builder', true);
    const at = useLearningPathStore.getState().saved['user-a']['boz-uy'].builder;
    // The server applied the write, but the device never heard back.
    backend.push('user-a', 'path_steps', [{ key: 'boz-uy|builder', base_rev: 0, deleted: false, payload: { at } }]);
    await sync();
    const rows = [...backend.rows.get('user-a')!.values()];
    expect(rows).toHaveLength(1);
    expect(rows[0].rev).toBe(1);
    expect(await hasUnsyncedPrivateState('user-a')).toBe(false);
  });
});

describe('deletion propagates', () => {
  it('a collection deleted on device A disappears on device B and is never resurrected', async () => {
    signInAs('user-a');
    const collection = useMyCollectionsStore.getState().create('user-a', { name: 'Temporary' });
    await sync();
    const deviceA = await snapshotDevice();

    await newDevice();
    signInAs('user-a');
    await sync();
    expect(ownerCollections(useMyCollectionsStore.getState().saved, 'user-a').collections).toHaveLength(1);
    const deviceB = await snapshotDevice();

    await restoreDevice(deviceA);
    signInAs('user-a');
    useMyCollectionsStore.getState().remove('user-a', collection.id);
    await sync();
    expect([...backend.rows.get('user-a')!.values()].find((row) => row.domain === 'collections')?.deleted).toBe(true);

    await restoreDevice(deviceB);
    signInAs('user-a');
    await sync();
    expect(ownerCollections(useMyCollectionsStore.getState().saved, 'user-a').collections).toHaveLength(0);
    await sync();
    expect([...backend.rows.get('user-a')!.values()].find((row) => row.domain === 'collections')?.deleted).toBe(true);
  });

  it('a removed audio bookmark and an unmarked path step sync as deletions', async () => {
    signInAs('user-a');
    const bookmark = useListeningStore.getState().addBookmark('user-a', { sourceType: 'komuz', sourceId: 'chon-kerbez', title: 'Чоң кербез', route: '/culture/komuz/listen', positionType: 'seconds', position: 74 });
    useLearningPathStore.getState().setManual('user-a', 'boz-uy', 'builder', true);
    await sync();
    useListeningStore.getState().removeBookmark('user-a', bookmark.id);
    useLearningPathStore.getState().setManual('user-a', 'boz-uy', 'builder', false);
    await settle();
    await sync();
    const rows = [...backend.rows.get('user-a')!.values()];
    expect(rows.find((row) => row.domain === 'audio_bookmarks')?.deleted).toBe(true);
    expect(rows.find((row) => row.domain === 'path_steps')?.deleted).toBe(true);
  });
});

describe('account safety', () => {
  it('guest data adopted locally is uploaded to THAT account only', async () => {
    useReadingStore.getState().markRead('guest', 'culture_item', 'boz-uy-overview');
    signInAs('user-a');
    useReadingStore.getState().adoptGuest('user-a');
    await sync();
    expect(backend.rows.get('user-a')?.size).toBe(1);
    expect(backend.rows.get('user-b')).toBeUndefined();
    expect(useReadingStore.getState().saved.guest).toBeUndefined();
  });

  it('A signs out after a clean sync -> A’s private data leaves the device; B sees only B; A gets it back', async () => {
    signInAs('user-a');
    const { highlight } = useHighlightsStore.getState().save('user-a', HIGHLIGHT);
    useHighlightsStore.getState().setNote('user-a', highlight.id, 'A only');
    await sync();
    expect(await hasUnsyncedPrivateState('user-a')).toBe(false);
    signOut();
    await forgetPrivateState('user-a');
    expect(useHighlightsStore.getState().saved['user-a']).toBeUndefined();
    expect(JSON.stringify(await snapshotDevice())).not.toContain('A only');

    signInAs('user-b');
    await sync();
    expect(useHighlightsStore.getState().saved['user-b'] ?? {}).toEqual({});
    expect(JSON.stringify(useHighlightsStore.getState().saved)).not.toContain('A only');

    signOut();
    signInAs('user-a');
    await sync();
    expect(useHighlightsStore.getState().saved['user-a'][highlight.id].note).toBe('A only');
    // Forgetting the device copy never deleted anything in the account.
    expect([...backend.rows.get('user-a')!.values()].every((row) => !row.deleted)).toBe(true);
  });

  it('a sync started for A never writes into the stores after the account changed', async () => {
    signInAs('user-a');
    backend.rows.set('user-a', new Map([['reading\u0000culture_item:x', { domain: 'reading', record_key: 'culture_item:x', rev: 1, deleted: false, payload: { contentType: 'culture_item', contentId: 'x', progress: 0.5, furthest: 0.5, lastReadAt: '2026-10-01T10:00:00.000Z', completedAt: null } }]]));
    const running = sync();
    signOut();
    signInAs('user-b');
    await expect(running).rejects.toBeTruthy();
    expect(useReadingStore.getState().saved['user-b']).toBeUndefined();
  });

  it('server rows are per user: B can never read A’s records', async () => {
    signInAs('user-a');
    useHighlightsStore.getState().save('user-a', HIGHLIGHT);
    await sync();
    signOut();
    signInAs('user-b');
    const { data } = await (client.supabase.from('user_state_records') as unknown as { select: () => { order: () => { order: () => { range: (a: number, b: number) => Promise<{ data: unknown[] }> } } } }).select().order().order().range(0, 999);
    expect(data).toEqual([]);
  });
});

describe('privacy', () => {
  it('note text and passages never reach analytics', async () => {
    signInAs('user-a');
    const { highlight } = useHighlightsStore.getState().save('user-a', HIGHLIGHT);
    useHighlightsStore.getState().setNote('user-a', highlight.id, 'secret-note-text');
    await sync();
    expect(JSON.stringify((track as jest.Mock).mock.calls)).not.toMatch(/secret-note-text|tunduk crowns/);
  });

  const sql = fs.readFileSync(path.join(__dirname, '../../../../supabase/migrations/20261002000001_private_state_sync.sql'), 'utf8').replace(/--[^\n]*/g, '');

  it('RLS: owner-only select, no client write path except the auth.uid() RPC', () => {
    expect(sql).toMatch(/alter table public\.user_state_records enable row level security/);
    const policies = sql.match(/create policy[^;]+;/g) ?? [];
    expect(policies).toHaveLength(1);
    expect(policies[0]).toMatch(/for select using \(auth\.uid\(\) = user_id\)/);
    expect(sql).toMatch(/revoke all on public\.user_state_records from anon/);
    expect(sql).toMatch(/revoke insert, update, delete, truncate on public\.user_state_records from authenticated/);
    expect(sql).toMatch(/v_user_id uuid := auth\.uid\(\)/);
    expect(sql).not.toMatch(/p_user_id/);
    expect(sql).toMatch(/security definer set search_path = public/);
    expect(sql).toMatch(/revoke all on function public\.push_user_state\(text, jsonb\) from public, anon/);
  });

  it('private records are not exposed by any admin/content RPC', () => {
    const migrations = fs.readdirSync(path.join(__dirname, '../../../../supabase/migrations')).filter((file) => file !== '20261002000001_private_state_sync.sql');
    for (const file of migrations) {
      expect(fs.readFileSync(path.join(__dirname, '../../../../supabase/migrations', file), 'utf8')).not.toMatch(/user_state_records/);
    }
  });
});

describe('domain merge rules (pure)', () => {
  it('reading: furthest wins, newest resume point, completed wins', () => {
    const base = { contentType: 'culture_item' as const, contentId: 'a', progress: 0.2, furthest: 0.2, lastReadAt: '2026-10-01T00:00:00Z', completedAt: null };
    const local = { ...base, progress: 0.95, furthest: 0.95, lastReadAt: '2026-10-01T01:00:00Z', completedAt: '2026-10-01T01:00:00Z' };
    const server = { ...base, progress: 0.4, furthest: 0.4, lastReadAt: '2026-10-01T02:00:00Z' };
    const merged = readingRules.merge(base, local, server, 'culture_item:a');
    expect(merged).toMatchObject({ progress: 0.4, furthest: 0.95, completedAt: '2026-10-01T01:00:00Z', lastReadAt: '2026-10-01T02:00:00Z' });
  });

  it('mistakes: a later correct review closes it; a later wrong answer reopens it; counts never double', () => {
    const base = { questionId: 'q', active: { questionId: 'q', firstWrongAt: 't1', lastWrongAt: 't1', wrongCount: 2 }, reviewedAt: null };
    const corrected = { questionId: 'q', active: null, reviewedAt: 't3' };
    const wrongAgain = { questionId: 'q', active: { questionId: 'q', firstWrongAt: 't1', lastWrongAt: 't2', wrongCount: 3 }, reviewedAt: null };
    expect(mistakeRules.merge(base, corrected, wrongAgain, 'q').active).toBeNull();
    const laterWrong = { ...wrongAgain, active: { ...wrongAgain.active, lastWrongAt: 't4' } };
    expect(mistakeRules.merge(base, corrected, laterWrong, 'q').active?.wrongCount).toBe(3);
  });

  it('collections: memberships merge three-way (a removal stays removed, an addition is kept)', () => {
    const c = { id: 'c', name: 'N', description: null, createdAt: 't0', updatedAt: 't1' };
    const item = (contentId: string, sortOrder: number) => ({ contentType: 'culture_item' as const, contentId, sortOrder, addedAt: 't0' });
    const base = { collection: c, items: [item('a', 0), item('b', 1)] };
    const local = { collection: { ...c, updatedAt: 't2' }, items: [item('a', 0)] }; // removed b
    const server = { collection: { ...c, name: 'Renamed', updatedAt: 't3' }, items: [item('a', 0), item('b', 1), item('c', 2)] }; // added c
    const merged = collectionRules.merge(base, local, server, 'c');
    expect(merged.items.map((entry) => entry.contentId)).toEqual(['a', 'c']);
    expect(merged.collection.name).toBe('Renamed');
  });

  it('an edit made while another device deleted the record is kept (never silently lost)', () => {
    const base = { glossaryEntryId: 'g', seenCount: 1, gotItCount: 1, reviewAgainCount: 0, lastReviewedAt: '2026-10-01T10:00:00.000Z', needsReview: false };
    const edited = { ...base, seenCount: 2, lastReviewedAt: '2026-10-01T11:00:00.000Z' };
    const result = reconcile(glossaryStudyRules, { g: edited }, { g: { rev: 2, deleted: true, payload: null } }, { g: { rev: 1, base } });
    expect(result.local.g).toEqual(edited);
    expect(result.push).toEqual([{ key: 'g', baseRev: 2, payload: edited }]);
  });

  it('an untouched record deleted elsewhere is deleted here (no resurrection)', () => {
    const base = { glossaryEntryId: 'g', seenCount: 1, gotItCount: 1, reviewAgainCount: 0, lastReviewedAt: '2026-10-01T10:00:00.000Z', needsReview: false };
    const result = reconcile(glossaryStudyRules, { g: base }, { g: { rev: 2, deleted: true, payload: null } }, { g: { rev: 1, base } });
    expect(result.local.g).toBeUndefined();
    expect(result.push).toEqual([]);
  });

  it('server JSON that fails validation is ignored, never written into a store', () => {
    const result = reconcile(readingRules, {}, { bad: { rev: 1, deleted: false, payload: { contentType: 'x' } } }, {});
    expect(result.local).toEqual({});
  });
});
