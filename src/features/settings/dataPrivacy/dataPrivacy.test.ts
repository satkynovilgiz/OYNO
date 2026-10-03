/**
 * Data & Privacy Center: status rules, honest cloud deletion (tombstones,
 * backend-not-deployed, offline), listening history vs bookmarks, offline
 * downloads isolation, export contents.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onlineManager } from '@tanstack/react-query';
import * as fs from 'fs';
import * as path from 'path';

import * as client from '@/services/supabase/client';
import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import { bumpAccountGeneration, captureAccountGeneration } from '@/services/sync/accountGeneration';
import { syncPrivateState, usePrivateSyncStatus, wipePrivateDomains, __resetPrivateSyncForTests } from '@/services/sync/privateSync/privateSync';
import type { FakeStateBackend } from '@/services/sync/privateSync/testing/fakeStateBackend';
import { useChallengeMistakesStore } from '@/store/useChallengeMistakesStore';
import { useGameRecordsStore } from '@/store/useGameRecordsStore';
import { useGlossaryStudyStore } from '@/store/useGlossaryStudyStore';
import { useHighlightsStore } from '@/store/useHighlightsStore';
import { useKomuzLibraryStore } from '@/store/useKomuzLibraryStore';
import { useLearningPathStore } from '@/store/useLearningPathStore';
import { useListeningStore } from '@/store/useListeningStore';
import { useMyCollectionsStore } from '@/store/useMyCollectionsStore';
import { useReadingStore } from '@/store/useReadingStore';
import { useWeeklyGoalStore } from '@/store/useWeeklyGoalStore';

import { categoryStatus, cloudSyncView, DATA_CATEGORIES, RESET_DOMAINS, SYNCED_DOMAIN_LABELS } from './dataPrivacyModel';
import { buildLearningExport } from './learningExport';

const mockAuth: { status: string; user: { id: string } | null } = { status: 'guest', user: null };
jest.mock('@/store/useAuthStore', () => ({ useAuthStore: { getState: () => mockAuth }, registerAccountHooks: jest.fn() }));
jest.mock('@/services/analytics/analytics', () => ({ track: jest.fn() }));
jest.mock('@/services/supabase/client', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const state = (require('@/services/sync/privateSync/testing/fakeStateBackend') as typeof import('@/services/sync/privateSync/testing/fakeStateBackend')).createFakeStateBackend();
  return {
    __state: state,
    supabase: {
      from: () => state.query(mockAuth.user!.id),
      rpc: (fn: string, args: Record<string, unknown>) => Promise.resolve(fn === 'push_user_state' ? state.push(mockAuth.user!.id, args.p_domain as string, args.p_items as never) : { data: null, error: null }),
    },
  };
});
const backend = (client as unknown as { __state: FakeStateBackend }).__state;

const STORES = [useReadingStore, useHighlightsStore, useMyCollectionsStore, useChallengeMistakesStore, useGameRecordsStore, useKomuzLibraryStore, useLearningPathStore, useListeningStore, useWeeklyGoalStore];
async function newDevice() {
  await AsyncStorage.clear();
  for (const store of STORES) (store as unknown as { setState: (s: object) => void }).setState({ saved: {}, isLoaded: false });
  useGlossaryStudyStore.setState({ saved: {}, sessions: {}, isLoaded: false });
  __resetPrivateSyncForTests();
  for (const store of [...STORES, useGlossaryStudyStore]) await (store.getState() as { load: () => Promise<void> }).load();
}
function signInAs(id: string | null) {
  mockAuth.status = id ? 'authenticated' : 'guest';
  mockAuth.user = id ? { id } : null;
  bumpAccountGeneration();
}
const sync = () => syncPrivateState(captureAccountGeneration());
const bookmark = { sourceType: 'komuz' as const, sourceId: 'chon-kerbez', title: 'Чоң кербез', route: '/culture/komuz/listen', positionType: 'seconds' as const, position: 74 };
const listen = (owner: string) => useListeningStore.getState().record(owner, { sourceType: 'komuz', sourceId: 'ak-maral-min', title: 'Ак марал мин', route: '/culture/komuz/listen', positionType: 'seconds', position: 10, completed: false, at: new Date().toISOString() });

beforeEach(async () => {
  backend.rows.clear();
  backend.fail = false;
  onlineManager.setOnline(true);
  signInAs(null);
  await newDevice();
});

describe('status (derived from the real architecture)', () => {
  it('guest: everything on this device; cloud sync not available while signed out', () => {
    const context = { signedIn: false, backend: 'unknown' as const, privateSyncedAt: null };
    expect(DATA_CATEGORIES.map((category) => categoryStatus(category, context)).every((status) => status === 'device')).toBe(true);
    expect(cloudSyncView(context, 'idle')).toEqual({ view: 'signed_out_unavailable', lastSyncedAt: null });
  });

  it('signed in: account tables synced; private data synced only after a real sync; downloads always device', () => {
    const synced = { signedIn: true, backend: 'available' as const, privateSyncedAt: '2026-10-03T10:00:00.000Z' };
    expect(categoryStatus('journal', synced)).toBe('account');
    expect(categoryStatus('highlights', synced)).toBe('account');
    expect(categoryStatus('offline_downloads', synced)).toBe('device');
    expect(cloudSyncView(synced, 'synced')).toEqual({ view: 'synced', lastSyncedAt: '2026-10-03T10:00:00.000Z' });
    const notYet = { ...synced, privateSyncedAt: null };
    expect(categoryStatus('private_learning', notYet)).toBe('not_synced');
    expect(cloudSyncView(notYet, 'idle')).toEqual({ view: 'not_synced_yet', lastSyncedAt: null });
  });

  it('offline -> waiting for connection; backend not deployed -> sync unavailable, never "synced"', () => {
    const context = { signedIn: true, backend: 'available' as const, privateSyncedAt: null };
    expect(cloudSyncView(context, 'offline').view).toBe('waiting');
    const missing = { signedIn: true, backend: 'missing' as const, privateSyncedAt: '2026-10-01T00:00:00Z' };
    expect(cloudSyncView(missing, 'idle')).toEqual({ view: 'unavailable', lastSyncedAt: null });
    expect(categoryStatus('listening', missing)).toBe('not_synced');
  });

  it('account A -> B: "last synced" is per owner, B never sees A’s', async () => {
    signInAs('user-a');
    useReadingStore.getState().markRead('user-a', 'culture_item', 'boz-uy-overview');
    await sync();
    expect(usePrivateSyncStatus.getState().syncedOwners['user-a']).toBeTruthy();
    signInAs('user-b');
    expect(usePrivateSyncStatus.getState().syncedOwners['user-b']).toBeUndefined();
    const screen = fs.readFileSync(path.join(__dirname, 'DataPrivacyScreen.tsx'), 'utf8');
    expect(screen).toMatch(/syncedOwners\[owner\]/);
    expect(screen).toMatch(/const owner = useRecordsOwner\(\)/);
  });

  it('synced learning data lists people-facing names only (no internal table names)', () => {
    for (const dict of [en, ru, kg]) {
      const text = JSON.stringify((dict as unknown as { dataPrivacy: unknown }).dataPrivacy);
      expect(text).not.toMatch(/user_state_records|push_user_state|glossary_sessions|path_steps|supabase/i);
    }
    expect(SYNCED_DOMAIN_LABELS.flatMap((entry) => entry.domains)).toHaveLength(12);
  });
});

describe('clear actions', () => {
  it('Clear listening history keeps audio bookmarks', async () => {
    listen('guest');
    useListeningStore.getState().addBookmark('guest', bookmark);
    expect(await wipePrivateDomains('guest', ['listening_history'])).toBe('device_only');
    expect(Object.keys(useListeningStore.getState().saved.guest.history)).toHaveLength(0);
    expect(Object.keys(useListeningStore.getState().saved.guest.bookmarks)).toHaveLength(1);
  });

  it('signed in + backend available: cleared history is tombstoned in the account and never restored', async () => {
    signInAs('user-a');
    listen('user-a');
    useListeningStore.getState().addBookmark('user-a', bookmark);
    await sync();
    expect(await wipePrivateDomains('user-a', ['listening_history'])).toBe('account');
    const rows = [...backend.rows.get('user-a')!.values()];
    expect(rows.find((row) => row.domain === 'listening_history')?.deleted).toBe(true);
    expect(rows.find((row) => row.domain === 'audio_bookmarks')?.deleted).toBe(false);
    await newDevice();
    signInAs('user-a');
    await sync();
    expect(Object.keys(useListeningStore.getState().saved['user-a']?.history ?? {})).toHaveLength(0);
    expect(Object.keys(useListeningStore.getState().saved['user-a'].bookmarks)).toHaveLength(1);
  });

  it('reset while offline: removed here, account copy removed on the next sync (no instant restore)', async () => {
    signInAs('user-a');
    useReadingStore.getState().markRead('user-a', 'culture_item', 'boz-uy-overview');
    useGlossaryStudyStore.getState().answer('user-a', 'tunduk', 'review_again');
    await sync();
    onlineManager.setOnline(false);
    expect(await wipePrivateDomains('user-a', RESET_DOMAINS)).toBe('pending');
    expect(useReadingStore.getState().saved['user-a']).toEqual({});
    onlineManager.setOnline(true);
    await sync();
    expect(useReadingStore.getState().saved['user-a']).toEqual({});
    expect([...backend.rows.get('user-a')!.values()].filter((row) => row.domain === 'reading' || row.domain === 'glossary_study').every((row) => row.deleted)).toBe(true);
  });

  it('backend not deployed: honest device-only result, no cloud deletion claimed', async () => {
    signInAs('user-a');
    useReadingStore.getState().markRead('user-a', 'culture_item', 'boz-uy-overview');
    backend.fail = 'missing';
    expect(await wipePrivateDomains('user-a', ['reading'])).toBe('device_only');
    expect(usePrivateSyncStatus.getState().backend).toBe('missing');
  });

  it('reset removes ONLY the listed domains (notes, collections, records, bookmarks stay)', async () => {
    signInAs(null);
    useHighlightsStore.getState().save('guest', { contentType: 'culture_item', contentId: 'boz-uy-overview', sectionKey: 'history', language: 'en', title: 'Boz Üy', text: 'Passage' });
    useMyCollectionsStore.getState().create('guest', { name: 'Mine' });
    useListeningStore.getState().addBookmark('guest', bookmark);
    useReadingStore.getState().markRead('guest', 'culture_item', 'boz-uy-overview');
    await wipePrivateDomains('guest', RESET_DOMAINS);
    expect(Object.keys(useHighlightsStore.getState().saved.guest)).toHaveLength(1);
    expect(useMyCollectionsStore.getState().saved.guest.collections).toHaveLength(1);
    expect(Object.keys(useListeningStore.getState().saved.guest.bookmarks)).toHaveLength(1);
    expect(useReadingStore.getState().saved.guest).toEqual({});
    expect(RESET_DOMAINS).not.toEqual(expect.arrayContaining(['highlights']));
  });

  it('Clear downloaded content uses only the Offline Downloads system', () => {
    const screen = fs.readFileSync(path.join(__dirname, 'DataPrivacyScreen.tsx'), 'utf8');
    const block = screen.slice(screen.indexOf("if (action === 'downloads')"), screen.indexOf("} else if (action === 'history')")).replace(/\/\/[^\n]*/g, '');
    expect(block).toMatch(/useOfflineStore\.getState\(\)\.removeAll\(\)/);
    expect(block).not.toMatch(/Journal|wipePrivateDomains|AsyncStorage|Reading|Highlights/);
    const offline = fs.readFileSync(path.join(__dirname, '../../../services/offline/offlineCache.ts'), 'utf8');
    expect(offline).toMatch(/OFFLINE_STORAGE_PREFIX = 'oyno\.offline\.'/);
  });

  it('destructive actions require confirmation; reset shows exactly what is removed + "cannot be undone"', () => {
    const screen = fs.readFileSync(path.join(__dirname, 'DataPrivacyScreen.tsx'), 'utf8');
    expect(screen).toMatch(/onPress=\{\(\) => setConfirm\('reset'\)\}/);
    expect(screen).toMatch(/resetLines\.map/);
    expect(screen).toMatch(/dataPrivacy\.cannotUndo/);
    expect(screen).not.toMatch(/delete everything/i);
    expect(screen).toMatch(/router\.push\('\/journal'/);
  });
});

describe('export', () => {
  it('contains the learning state (notes only because the person asked) and no secrets or ids', () => {
    const exported = buildLearningExport(
      {
        reading: { 'culture_item:a': { contentType: 'culture_item', contentId: 'a', progress: 0.5, furthest: 0.5, lastReadAt: '2026-10-01T00:00:00Z', completedAt: null } },
        highlights: { h: { id: 'h', contentType: 'culture_item', contentId: 'a', sectionKey: 's', language: 'en', titleSnapshot: 'T', excerptSnapshot: 'P', note: 'my note', createdAt: 'x', updatedAt: 'x' } },
        collections: { collections: [{ id: 'col-123', name: 'Mine', description: null, createdAt: 'x', updatedAt: 'x' }], items: [] },
        mistakes: { active: {}, reviewedAt: {} },
        glossaryStudy: {},
        glossarySessions: [],
        gameRecords: { recent: {}, best: { ordo: 3 }, sessions: { ordo: 2 }, wins: {} },
        komuzFavorites: [],
        pathSteps: {},
        listening: { history: {}, bookmarks: {} },
        weeklyGoal: 5,
      },
      new Date('2026-10-03T00:00:00Z'),
    );
    const json = JSON.stringify(exported);
    expect(json).toMatch(/my note/);
    expect(json).not.toMatch(/token|access_token|refresh|userId|user_id|owner|session_id|analytics|col-123|supabase/i);
    expect(exported).toMatchObject({ format: 'oyno-learning-data/1', weeklyGoal: 5, gameRecords: { personalBests: { ordo: 3 } } });
  });

  it('export is offered only where a real file + share sheet exist, after a confirmation that mentions notes', () => {
    const screen = fs.readFileSync(path.join(__dirname, 'DataPrivacyScreen.tsx'), 'utf8');
    expect(screen).toMatch(/learningExportSupported\(\) \? <SettingsRow/);
    expect(screen).toMatch(/dataPrivacy\.notesIncluded/);
    const service = fs.readFileSync(path.join(__dirname, 'exportLearningData.ts'), 'utf8');
    expect(service).toMatch(/Platform\.OS === 'web'\) return false/);
    expect(service).toMatch(/file\.delete\(\)/);
  });

  it('analytics carry no private payload', () => {
    const screen = fs.readFileSync(path.join(__dirname, 'DataPrivacyScreen.tsx'), 'utf8');
    for (const match of screen.match(/track\([^)]*\)/g) ?? []) expect(match).toMatch(/^track\('(privacy_center_opened|data_export_started|private_data_reset)'\)$/);
  });
});

describe('localization', () => {
  it('KG / RU / EN', () => {
    for (const dict of [en, ru, kg]) {
      const block = (dict as unknown as { dataPrivacy: Record<string, unknown> }).dataPrivacy;
      for (const key of ['title', 'learningData', 'clearHistory', 'clearDownloads', 'resetLearning', 'export', 'notesIncluded', 'cannotUndo', 'lastSynced']) expect(block[key]).toBeTruthy();
      const status = block.status as Record<string, string>;
      expect(status.device && status.account).toBeTruthy();
    }
  });
});
