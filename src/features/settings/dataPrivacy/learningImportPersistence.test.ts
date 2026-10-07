/**
 * Backup import at the PERSISTENCE boundary: real stores, their real
 * (debounced, error-swallowing) storage writes, and injected storage
 * failures. A "restart" = fresh in-memory stores loaded from storage.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORE_ADAPTERS } from '@/services/sync/privateSync/storeAdapters';
import { ownerMistakes, useChallengeMistakesStore } from '@/store/useChallengeMistakesStore';
import { GAME_RECORDS_KEY, ownerRecords, useGameRecordsStore } from '@/store/useGameRecordsStore';
import { ownerStudy, useGlossaryStudyStore } from '@/store/useGlossaryStudyStore';
import { useHighlightsStore } from '@/store/useHighlightsStore';
import { useKomuzLibraryStore } from '@/store/useKomuzLibraryStore';
import { useLearningPathStore } from '@/store/useLearningPathStore';
import { useListeningStore } from '@/store/useListeningStore';
import { ownerCollections, useMyCollectionsStore } from '@/store/useMyCollectionsStore';
import { ownerReading, READING_KEY, useReadingStore } from '@/store/useReadingStore';
import { useWeeklyGoalStore } from '@/store/useWeeklyGoalStore';

import { __resetImportLockForTests, applyLearningImport, backupFingerprint, defaultImportDeps, PENDING_IMPORT_KEY, previewLearningImport, readPendingImport, type ImportDeps, type PendingImport } from './applyLearningImport';
import { buildLearningExport, type LearningExportInput } from './learningExport';
import { parseLearningBackup, type ParsedBackup } from './learningImport';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));
jest.mock('@/services/analytics/analytics', () => ({ track: jest.fn() }));
const mockAuth = { owner: 'guest' };
jest.mock('@/store/useAuthStore', () => ({ useAuthStore: { getState: () => (mockAuth.owner === 'guest' ? { status: 'guest', user: null } : { status: 'authenticated', user: { id: mockAuth.owner } }) }, registerAccountHooks: jest.fn() }));

const T1 = '2026-09-01T10:00:00.000Z';
const NOW = new Date('2026-10-01T12:00:00.000Z');
// Synthetic data only.
const COLLECTION = 'Synthetic felt collection 4q';
const input = (): LearningExportInput => ({
  reading: { 'culture_item:boz-uy-overview': { contentType: 'culture_item', contentId: 'boz-uy-overview', progress: 0.6, furthest: 0.6, lastReadAt: T1, completedAt: null } },
  highlights: {},
  collections: { collections: [{ id: 'uc_a', name: COLLECTION, description: null, createdAt: T1, updatedAt: T1 }], items: [{ collectionId: 'uc_a', contentType: 'culture_item', contentId: 'shyrdak-craft', sortOrder: 0, addedAt: T1 }] },
  mistakes: { active: { 'tunduk-flag': { questionId: 'tunduk-flag', firstWrongAt: T1, lastWrongAt: T1, wrongCount: 2 } }, reviewedAt: {} },
  glossaryStudy: { tunduk: { glossaryEntryId: 'tunduk', seenCount: 3, gotItCount: 1, reviewAgainCount: 2, lastReviewedAt: T1, needsReview: true } },
  glossarySessions: [T1],
  gameRecords: { recent: {}, best: { jaa_atuu: 120 }, sessions: { jaa_atuu: 4 }, wins: {} },
  komuzFavorites: ['ak-maral-min'],
  pathSteps: { 'boz-uy': { build: T1 } },
  listening: { history: {}, bookmarks: {} },
  weeklyGoal: 5,
});
const backup = (): ParsedBackup => {
  const result = parseLearningBackup(JSON.stringify(buildLearningExport(input(), NOW)), undefined, NOW);
  if (!result.ok) throw new Error(result.error);
  return result.backup;
};

const STORES = [useReadingStore, useHighlightsStore, useMyCollectionsStore, useChallengeMistakesStore, useGameRecordsStore, useWeeklyGoalStore, useLearningPathStore, useGlossaryStudyStore, useKomuzLibraryStore, useListeningStore] as unknown as { setState: (state: unknown) => void }[];
/** A fresh app process: nothing in memory, everything from storage. */
async function restart() {
  for (const store of STORES) store.setState({ saved: {}, sessions: {}, isLoaded: false });
  await Promise.all(STORE_ADAPTERS.map((adapter) => adapter.load()));
}

/** Real persistence and the real disk check; only waiting is shortened (still longer than the 500 ms debounce). */
const deps = (over: Partial<ImportDeps> = {}): ImportDeps => ({ ...defaultImportDeps, owner: () => mockAuth.owner, deletedKeys: async () => ({}), cloud: () => 'device_only_guest', requestSync: jest.fn(), settle: () => new Promise((resolve) => setTimeout(resolve, 600)), ...over });

const setItem = AsyncStorage.setItem as jest.Mock;
let realSetItem: (key: string, value: string) => Promise<void>;
const failingKeys = new Set<string>();

beforeAll(() => {
  realSetItem = setItem.getMockImplementation() as typeof realSetItem;
  setItem.mockImplementation((key: string, value: string) => (failingKeys.has(key) ? Promise.reject(new Error('disk full')) : realSetItem(key, value)));
});
afterAll(() => setItem.mockImplementation(realSetItem));

const logged: unknown[][] = [];
beforeEach(async () => {
  failingKeys.clear();
  await AsyncStorage.clear();
  mockAuth.owner = 'guest';
  __resetImportLockForTests();
  await restart();
  logged.length = 0;
  for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) jest.spyOn(console, method).mockImplementation((...args) => void logged.push(args));
});
afterEach(() => {
  // Private backup contents never reach a log.
  expect(JSON.stringify(logged)).not.toMatch(/Synthetic|boz-uy|tunduk|shyrdak/);
  jest.restoreAllMocks();
});

const diskReading = async (owner: string) => (JSON.parse((await AsyncStorage.getItem(READING_KEY)) ?? '{}') as Record<string, unknown>)[owner];

describe('a storage write failing partway', () => {
  it('is reported as partial (never "imported"), keeps the recovery marker, and storage holds the rest', async () => {
    failingKeys.add(READING_KEY);
    const outcome = await applyLearningImport(backup(), 'guest', deps());
    expect(outcome).toEqual({ ok: false, error: 'apply_partial' });
    expect(await readPendingImport('guest')).not.toBeNull();
    expect(await diskReading('guest')).toBeUndefined(); // the failed store
    expect(JSON.parse((await AsyncStorage.getItem(GAME_RECORDS_KEY))!).guest).toBeDefined(); // the others persisted
  }, 15000);

  it('restart, then the same backup again: completes, no duplicates, no inflated counts', async () => {
    failingKeys.add(READING_KEY);
    await applyLearningImport(backup(), 'guest', deps());
    failingKeys.clear();
    await restart(); // memory = what really reached storage
    expect(ownerReading(useReadingStore.getState().saved, 'guest')).toEqual({});

    __resetImportLockForTests();
    const preview = await previewLearningImport(backup(), 'guest', deps());
    if (!preview.ok) throw new Error('preview');
    // Only the missing part is new; everything that persisted is "already here".
    expect(preview.domains.find((entry) => entry.domain === 'reading')).toMatchObject({ added: 1 });
    expect(preview.domains.find((entry) => entry.domain === 'game_records')).toMatchObject({ added: 0, updated: 0, unchanged: 1 });
    const outcome = await applyLearningImport(backup(), 'guest', deps(), { preview: preview.domains });
    expect(outcome).toMatchObject({ ok: true, matchesPreview: true });
    expect(await readPendingImport('guest')).toBeNull();

    await restart();
    expect(ownerReading(useReadingStore.getState().saved, 'guest')['culture_item:boz-uy-overview']).toBeDefined();
    expect(ownerCollections(useMyCollectionsStore.getState().saved, 'guest').collections).toHaveLength(1);
    expect(ownerRecords(useGameRecordsStore.getState().saved, 'guest').sessions.jaa_atuu).toBe(4);
    expect(ownerStudy(useGlossaryStudyStore.getState().saved, 'guest').tunduk.seenCount).toBe(3);
    expect(ownerMistakes(useChallengeMistakesStore.getState().saved, 'guest').active['tunduk-flag'].wrongCount).toBe(2);
    expect(useGlossaryStudyStore.getState().sessions.guest).toHaveLength(1);
  }, 20000);

  it('no restart, storage recovers, the same backup again: nothing new, but the stale store is written again', async () => {
    failingKeys.add(READING_KEY);
    await applyLearningImport(backup(), 'guest', deps());
    failingKeys.clear();
    __resetImportLockForTests();
    const outcome = await applyLearningImport(backup(), 'guest', deps());
    expect(outcome).toMatchObject({ ok: true, domains: [], repaired: ['reading'] });
    expect(await diskReading('guest')).toBeDefined();
    expect(await readPendingImport('guest')).toBeNull();
  }, 20000);
});

describe('restart after an interrupted import', () => {
  it('the marker survives the restart and re-importing completes and clears it', async () => {
    // Killed before the stores persisted (settle never ends).
    void applyLearningImport(backup(), 'guest', deps({ settle: () => new Promise(() => undefined) }));
    await new Promise((resolve) => setTimeout(resolve, 50));
    __resetImportLockForTests();
    // The stores' own writes may or may not have happened; storage is whatever it is.
    await restart();
    expect(await readPendingImport('guest')).not.toBeNull();
    const outcome = await applyLearningImport(backup(), 'guest', deps());
    expect(outcome.ok).toBe(true);
    expect(await readPendingImport('guest')).toBeNull();
    await restart();
    expect(ownerCollections(useMyCollectionsStore.getState().saved, 'guest').collections).toHaveLength(1);
  }, 20000);
});

describe('stores still loading', () => {
  it("an app-start load finishing AFTER the import can't overwrite it", async () => {
    // Something was on disk before; the app's own load of it is slow.
    await realSetItem(READING_KEY, JSON.stringify({ guest: {} }));
    for (const store of STORES) store.setState({ saved: {}, sessions: {}, isLoaded: false });
    const getItem = AsyncStorage.getItem as jest.Mock;
    const realGetItem = getItem.getMockImplementation()!;
    let releaseSlow!: () => void;
    const slow = new Promise<void>((resolve) => (releaseSlow = resolve));
    getItem.mockImplementationOnce(async (key: string) => {
      const before = await realGetItem(key); // read BEFORE the import ...
      await slow; // ... delivered after it
      return before;
    });
    const appStartLoad = useReadingStore.getState().load(); // slow
    const outcome = await applyLearningImport(backup(), 'guest', deps());
    expect(outcome.ok).toBe(true);
    releaseSlow();
    await appStartLoad;
    expect(ownerReading(useReadingStore.getState().saved, 'guest')['culture_item:boz-uy-overview']).toBeDefined();
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(await diskReading('guest')).toBeDefined();
  }, 15000);
});

describe('owner binding', () => {
  it('account switch after preview, before confirming: nothing is written for anyone', async () => {
    const preview = await previewLearningImport(backup(), 'guest', deps());
    expect(preview.ok).toBe(true);
    mockAuth.owner = 'user-b';
    expect(await applyLearningImport(backup(), 'guest', deps())).toEqual({ ok: false, error: 'owner_changed' });
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(await AsyncStorage.getItem(READING_KEY)).toBeNull();
    expect(useReadingStore.getState().saved).toEqual({});
  });

  it('account switch while the import is persisting: the data stays in the confirming owner\'s slice only', async () => {
    mockAuth.owner = 'user-a';
    const outcome = await applyLearningImport(
      backup(),
      'user-a',
      deps({
        settle: async () => {
          mockAuth.owner = 'user-b'; // A signs out, B signs in, mid-import
          await new Promise((resolve) => setTimeout(resolve, 600));
        },
      }),
    );
    expect(outcome.ok).toBe(true);
    await restart();
    expect(Object.keys(useReadingStore.getState().saved)).toEqual(['user-a']);
    expect(useKomuzLibraryStore.getState().saved['user-b']).toBeUndefined();
    expect(useMyCollectionsStore.getState().saved['user-b']).toBeUndefined();
  }, 15000);
});

describe('interrupted AFTER the data persisted, BEFORE the marker was removed', () => {
  const FILE = JSON.stringify(buildLearningExport(input(), NOW));
  const FP = backupFingerprint(FILE);
  const unrelated: PendingImport[] = [
    { owner: 'user-b', fingerprint: FP, startedAt: T1 }, // another account, same file
    { owner: 'guest', fingerprint: 'other-backup-9', startedAt: T1 }, // same owner, another file
  ];
  const markers = async () => JSON.parse((await AsyncStorage.getItem(PENDING_IMPORT_KEY)) ?? '[]') as PendingImport[];

  /** Runs an import that dies exactly in the window: verified on disk, marker removal never happens. */
  async function importAndDieBeforeMarkerRemoval() {
    let reachedRemoval!: () => void;
    const reached = new Promise<void>((resolve) => (reachedRemoval = resolve));
    void applyLearningImport(backup(), 'guest', deps({ clearPending: () => (reachedRemoval(), new Promise<boolean>(() => undefined)) }), { fingerprint: FP });
    await reached;
    __resetImportLockForTests(); // the process is gone
    await restart();
  }

  it('re-importing the same file clears its warning, adds nothing twice, and keeps unrelated markers', async () => {
    await AsyncStorage.setItem(PENDING_IMPORT_KEY, JSON.stringify(unrelated));
    await importAndDieBeforeMarkerRemoval();
    // Precondition of the bug: everything persisted, and the warning is still there.
    expect(ownerRecords(useGameRecordsStore.getState().saved, 'guest').sessions.jaa_atuu).toBe(4);
    expect(await readPendingImport('guest')).toMatchObject({ fingerprint: FP });

    const outcome = await applyLearningImport(backup(), 'guest', deps(), { fingerprint: FP });
    expect(outcome).toMatchObject({ ok: true, domains: [], repaired: [], markerRemains: false });
    expect((await markers()).filter((marker) => marker.owner === 'guest' && marker.fingerprint === FP)).toEqual([]);
    expect(await markers()).toEqual(unrelated);

    await restart();
    expect(ownerCollections(useMyCollectionsStore.getState().saved, 'guest').collections).toHaveLength(1);
    expect(ownerRecords(useGameRecordsStore.getState().saved, 'guest').sessions.jaa_atuu).toBe(4);
    expect(ownerStudy(useGlossaryStudyStore.getState().saved, 'guest').tunduk.seenCount).toBe(3);
    expect(useGlossaryStudyStore.getState().sessions.guest).toHaveLength(1);
  }, 20000);

  it('a DIFFERENT backup does not clear this file\'s warning', async () => {
    await importAndDieBeforeMarkerRemoval();
    const other = input();
    other.komuzFavorites = ['ak-maral-min', 'kambarkan'];
    const otherFile = JSON.stringify(buildLearningExport(other, NOW));
    const parsed = parseLearningBackup(otherFile, undefined, NOW);
    if (!parsed.ok) throw new Error(parsed.error);
    expect((await applyLearningImport(parsed.backup, 'guest', deps(), { fingerprint: backupFingerprint(otherFile) })).ok).toBe(true);
    expect((await markers()).some((marker) => marker.owner === 'guest' && marker.fingerprint === FP)).toBe(true);
  }, 20000);

  it('verification failing: the warning stays', async () => {
    await importAndDieBeforeMarkerRemoval();
    // Storage was damaged meanwhile and keeps failing.
    await AsyncStorage.removeItem(READING_KEY);
    failingKeys.add(READING_KEY);
    expect(await applyLearningImport(backup(), 'guest', deps(), { fingerprint: FP })).toEqual({ ok: false, error: 'apply_partial' });
    expect(await readPendingImport('guest')).toMatchObject({ fingerprint: FP });
  }, 20000);

  it('the marker cannot be removed: the data is fine and the result says the warning may remain', async () => {
    await importAndDieBeforeMarkerRemoval();
    failingKeys.add(PENDING_IMPORT_KEY);
    const removeItem = AsyncStorage.removeItem as jest.Mock;
    const realRemove = removeItem.getMockImplementation()!;
    removeItem.mockImplementation((key: string) => (failingKeys.has(key) ? Promise.reject(new Error('disk full')) : realRemove(key)));
    const outcome = await applyLearningImport(backup(), 'guest', deps(), { fingerprint: FP }).finally(() => removeItem.mockImplementation(realRemove));
    expect(outcome).toMatchObject({ ok: true, markerRemains: true });
    failingKeys.clear();
    expect(await readPendingImport('guest')).not.toBeNull();
  }, 20000);

  it('reads a marker written by the previous version (a single object)', async () => {
    await AsyncStorage.setItem(PENDING_IMPORT_KEY, JSON.stringify({ owner: 'guest', fingerprint: FP, startedAt: T1 }));
    expect(await readPendingImport('guest')).toMatchObject({ fingerprint: FP });
    // Data already here and verified -> the old marker is cleared too.
    await applyLearningImport(backup(), 'guest', deps(), { fingerprint: FP });
    __resetImportLockForTests();
    expect((await applyLearningImport(backup(), 'guest', deps(), { fingerprint: FP })).ok).toBe(true);
    expect(await readPendingImport('guest')).toBeNull();
  }, 20000);
});
