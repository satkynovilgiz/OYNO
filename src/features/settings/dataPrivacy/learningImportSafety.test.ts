import AsyncStorage from '@react-native-async-storage/async-storage';
import * as fs from 'fs';
import * as path from 'path';

import { STORE_ADAPTERS, type StoreAdapter } from '@/services/sync/privateSync/storeAdapters';
import { ownerMistakes, useChallengeMistakesStore } from '@/store/useChallengeMistakesStore';
import { ownerRecords, useGameRecordsStore } from '@/store/useGameRecordsStore';
import { ownerStudy, useGlossaryStudyStore } from '@/store/useGlossaryStudyStore';
import { ownerHighlights, useHighlightsStore } from '@/store/useHighlightsStore';
import { ownerLibrary, useKomuzLibraryStore } from '@/store/useKomuzLibraryStore';
import { ownerManualSteps, useLearningPathStore } from '@/store/useLearningPathStore';
import { ownerListening, useListeningStore } from '@/store/useListeningStore';
import { ownerCollections, useMyCollectionsStore } from '@/store/useMyCollectionsStore';
import { ownerReading, useReadingStore } from '@/store/useReadingStore';
import { ownerGoal, useWeeklyGoalStore } from '@/store/useWeeklyGoalStore';

import { __resetImportLockForTests, applyLearningImport, backupFingerprint, PENDING_IMPORT_KEY, previewLearningImport, readPendingImport, type ImportDeps } from './applyLearningImport';
import { buildLearningExport, type LearningExportInput } from './learningExport';
import { parseLearningBackup, type ParsedBackup } from './learningImport';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));
jest.mock('@/services/analytics/analytics', () => ({ track: jest.fn() }));
jest.mock('@/store/useAuthStore', () => ({ useAuthStore: { getState: () => ({ status: 'guest', user: null }) }, registerAccountHooks: jest.fn() }));

// Synthetic data only.
const T1 = '2026-09-01T10:00:00.000Z';
const T2 = '2026-09-20T10:00:00.000Z';
const NOW = new Date('2026-10-01T12:00:00.000Z');
const NOTE = 'synthetic private note 5p1q';

/** Every exported domain non-empty. */
const fullInput = (): LearningExportInput => ({
  reading: { 'culture_item:boz-uy-overview': { contentType: 'culture_item', contentId: 'boz-uy-overview', progress: 0.4, furthest: 0.6, lastReadAt: T1, completedAt: null } },
  highlights: { h1: { id: 'h1', contentType: 'culture_item', contentId: 'boz-uy-tunduk', sectionKey: 'history', language: 'en', titleSnapshot: 'Tunduk', excerptSnapshot: 'The crown of the yurt', note: NOTE, createdAt: T1, updatedAt: T1 } },
  collections: { collections: [{ id: 'uc_a', name: 'Felt', description: null, createdAt: T1, updatedAt: T1 }], items: [{ collectionId: 'uc_a', contentType: 'culture_item', contentId: 'shyrdak-craft', sortOrder: 0, addedAt: T1 }] },
  mistakes: { active: { 'tunduk-flag': { questionId: 'tunduk-flag', firstWrongAt: T1, lastWrongAt: T1, wrongCount: 2 } }, reviewedAt: { 'komuz-strings': T1 } },
  glossaryStudy: { tunduk: { glossaryEntryId: 'tunduk', seenCount: 3, gotItCount: 1, reviewAgainCount: 2, lastReviewedAt: T1, needsReview: true } },
  glossarySessions: [T1, T2],
  gameRecords: { recent: {}, best: { jaa_atuu: 120 }, sessions: { jaa_atuu: 4 }, wins: { jaa_atuu: 1 } },
  komuzFavorites: ['ak-maral-min'],
  pathSteps: { 'boz-uy': { build: T1 } },
  listening: {
    history: { 'culture_item:boz-uy-tunduk': { key: 'culture_item:boz-uy-tunduk', sourceType: 'guide', sourceId: 'culture_item:boz-uy-tunduk', title: 'Tunduk', route: '/culture/item/boz-uy-tunduk', positionType: 'seconds', position: 42, lastListenedAt: T1, completed: false } },
    bookmarks: { b1: { id: 'b1', sourceType: 'komuz', sourceId: 'ak-maral-min', title: 'Ak Maral', route: '/culture/komuz', positionType: 'seconds', position: 10, createdAt: T1 } },
  },
  weeklyGoal: 5,
});
const fileText = (input = fullInput(), extra: Record<string, unknown> = {}) => JSON.stringify({ ...buildLearningExport(input, NOW), ...extra });
const parse = (text: string): ParsedBackup => {
  const result = parseLearningBackup(text, text.length, NOW);
  if (!result.ok) throw new Error(result.error);
  return result.backup;
};

const STORES = [useReadingStore, useHighlightsStore, useMyCollectionsStore, useChallengeMistakesStore, useGameRecordsStore, useWeeklyGoalStore, useLearningPathStore, useGlossaryStudyStore, useKomuzLibraryStore, useListeningStore] as unknown as { setState: (state: unknown) => void; getState: () => Record<string, unknown> }[];
const snapshot = () => JSON.stringify(STORES.map((store) => [store.getState().saved, store.getState().sessions]));

/** What "Export my learning data" would write for this owner now (same selectors as the Data & Privacy screen). */
function exportFromStores(owner: string): string {
  const study = useGlossaryStudyStore.getState();
  return JSON.stringify(
    buildLearningExport(
      {
        reading: ownerReading(useReadingStore.getState().saved, owner),
        highlights: ownerHighlights(useHighlightsStore.getState().saved, owner),
        collections: ownerCollections(useMyCollectionsStore.getState().saved, owner),
        mistakes: ownerMistakes(useChallengeMistakesStore.getState().saved, owner),
        glossaryStudy: ownerStudy(study.saved, owner),
        glossarySessions: study.sessions[owner] ?? [],
        gameRecords: ownerRecords(useGameRecordsStore.getState().saved, owner),
        komuzFavorites: ownerLibrary(useKomuzLibraryStore.getState().saved, owner).favorites,
        pathSteps: ownerManualSteps(useLearningPathStore.getState().saved, owner),
        listening: ownerListening(useListeningStore.getState().saved, owner),
        weeklyGoal: ownerGoal(useWeeklyGoalStore.getState().saved, owner).goal,
      },
      NOW,
    ),
  );
}

let pendingWrites: string[] = [];
const deps = (owner: string | (() => string), over: Partial<ImportDeps> = {}): ImportDeps => ({
  owner: typeof owner === 'string' ? () => owner : owner,
  adapters: STORE_ADAPTERS.map((adapter) => ({ ...adapter, load: async () => {} })),
  deletedKeys: async () => ({}),
  cloud: () => 'device_only_guest',
  requestSync: jest.fn(),
  markPending: async (pending) => {
    pendingWrites.push(JSON.stringify(pending));
    await AsyncStorage.setItem(PENDING_IMPORT_KEY, JSON.stringify(pending));
    return true;
  },
  clearPending: () => AsyncStorage.removeItem(PENDING_IMPORT_KEY),
  settle: async () => {},
  unpersisted: async () => [],
  ...over,
});

beforeEach(async () => {
  await AsyncStorage.clear();
  pendingWrites = [];
  __resetImportLockForTests();
  for (const store of STORES) store.setState({ saved: {}, sessions: {}, isLoaded: true });
});

describe('invalid files change nothing', () => {
  it.each([
    ['not JSON', '{oops'],
    ['wrong schema', JSON.stringify({ schema: 'something-else', version: 1, exportedAt: T1 })],
    ['newer version', JSON.stringify({ ...JSON.parse(fileText()), version: 9 })],
    ['malformed record', fileText(undefined, { komuzFavorites: [42] })],
    ['dated in the future', JSON.stringify({ ...JSON.parse(fileText()), exportedAt: '2027-01-01T00:00:00.000Z' })],
  ])('%s: rejected before any store is read or written', (_label, text) => {
    const before = snapshot();
    expect(parseLearningBackup(text, text.length, NOW).ok).toBe(false);
    expect(snapshot()).toBe(before);
  });

  it('accepts a file saved with a byte-order mark', () => {
    expect(parseLearningBackup(`﻿${fileText()}`, undefined, NOW).ok).toBe(true);
  });

  it('the preview is a dry run: it never writes, even when a write would fail', async () => {
    const adapters: StoreAdapter[] = STORE_ADAPTERS.map((adapter) => ({ ...adapter, load: async () => {}, write: () => { throw new Error('must not write'); }, forget: () => { throw new Error('must not forget'); } }));
    const before = snapshot();
    const preview = await previewLearningImport(parse(fileText()), 'guest', deps('guest', { adapters }));
    expect(preview.ok).toBe(true);
    expect(snapshot()).toBe(before);
    expect(pendingWrites).toEqual([]);
  });
});

describe('preview totals = actual outcome', () => {
  it('into an empty device: every record is "added", and the outcome matches the preview exactly', async () => {
    const backup = parse(fileText());
    const preview = await previewLearningImport(backup, 'guest', deps('guest'));
    if (!preview.ok) throw new Error('preview failed');
    expect(preview.domains.every((entry) => entry.updated === 0 && entry.unchanged === 0 && entry.kept === 0)).toBe(true);
    expect(preview.domains.reduce((sum, entry) => sum + entry.added, 0)).toBe(Object.values(backup.records).reduce((sum, records) => sum + Object.keys(records ?? {}).length, 0));
    const outcome = await applyLearningImport(backup, 'guest', deps('guest'), { preview: preview.domains });
    expect(outcome.ok && outcome.matchesPreview).toBe(true);
    expect(outcome.ok && outcome.domains).toEqual(preview.domains);
  });

  it('existing records are counted as kept / unchanged / updated - and the outcome agrees', async () => {
    await applyLearningImport(parse(fileText()), 'guest', deps('guest'));
    // Something only here, something the backup improves.
    useKomuzLibraryStore.getState().applySyncedFavorites('guest', ['ak-maral-min', 'only-here']);
    const newer = fullInput();
    newer.gameRecords = { ...newer.gameRecords, best: { jaa_atuu: 150 } };
    const backup = parse(fileText(newer));
    const preview = await previewLearningImport(backup, 'guest', deps('guest'));
    if (!preview.ok) throw new Error('preview failed');
    const byDomain = Object.fromEntries(preview.domains.map((entry) => [entry.domain, entry]));
    expect(byDomain.game_records).toMatchObject({ added: 0, updated: 1, unchanged: 0 });
    expect(byDomain.komuz_favorites).toMatchObject({ added: 0, updated: 0, unchanged: 1, kept: 1 });
    expect(byDomain.reading).toMatchObject({ added: 0, updated: 0, unchanged: 1 });
    const outcome = await applyLearningImport(backup, 'guest', deps('guest'), { preview: preview.domains });
    expect(outcome.ok && outcome.matchesPreview).toBe(true);
  });

  it('says so when data changed between preview and import', async () => {
    const backup = parse(fileText());
    const preview = await previewLearningImport(backup, 'guest', deps('guest'));
    if (!preview.ok) throw new Error('preview failed');
    useKomuzLibraryStore.getState().applySyncedFavorites('guest', ['ak-maral-min']);
    const outcome = await applyLearningImport(backup, 'guest', deps('guest'), { preview: preview.domains });
    expect(outcome.ok && outcome.matchesPreview).toBe(false);
  });
});

describe('importing twice is safe', () => {
  it('every domain: the second import of the same file changes nothing and counts nothing twice', async () => {
    const backup = parse(fileText());
    await applyLearningImport(backup, 'guest', deps('guest'));
    const after = snapshot();
    const again = await applyLearningImport(backup, 'guest', deps('guest'));
    expect(again.ok && again.domains).toEqual([]);
    expect(snapshot()).toBe(after);
    const games = ownerRecords(useGameRecordsStore.getState().saved, 'guest');
    expect(games.sessions.jaa_atuu).toBe(4);
    expect(ownerStudy(useGlossaryStudyStore.getState().saved, 'guest').tunduk.seenCount).toBe(3);
    expect(useGlossaryStudyStore.getState().sessions.guest).toHaveLength(2);
    expect(ownerMistakes(useChallengeMistakesStore.getState().saved, 'guest').active['tunduk-flag'].wrongCount).toBe(2);
  });

  it('re-importing your own fresh export changes nothing (reading keeps its resume point)', async () => {
    await applyLearningImport(parse(fileText()), 'guest', deps('guest'));
    // Resume earlier than the furthest point - the export only keeps "furthest".
    const reading = ownerReading(useReadingStore.getState().saved, 'guest');
    useReadingStore.getState().applySynced('guest', { ...reading, 'culture_item:boz-uy-overview': { ...reading['culture_item:boz-uy-overview'], progress: 0.2 } });
    const before = snapshot();
    const outcome = await applyLearningImport(parse(exportFromStores('guest')), 'guest', deps('guest'));
    expect(outcome.ok && outcome.domains).toEqual([]);
    expect(snapshot()).toBe(before);
    expect(ownerReading(useReadingStore.getState().saved, 'guest')['culture_item:boz-uy-overview'].progress).toBe(0.2);
  });
});

describe('concurrency and account binding', () => {
  it('two taps: the file is applied once; the second is refused as busy', async () => {
    const backup = parse(fileText());
    const [first, second] = await Promise.all([applyLearningImport(backup, 'guest', deps('guest')), applyLearningImport(backup, 'guest', deps('guest'))]);
    expect([first.ok, second.ok ? 'ok' : second.error].sort()).toEqual(['busy', true].sort());
    expect(pendingWrites).toHaveLength(1);
  });

  it('account switch while stores load: nothing is written for anyone', async () => {
    let owner = 'user-a';
    const adapters = STORE_ADAPTERS.map((adapter) => ({
      ...adapter,
      load: async () => {
        owner = 'user-b';
      },
    }));
    const before = snapshot();
    expect(await applyLearningImport(parse(fileText()), 'user-a', deps(() => owner, { adapters }))).toEqual({ ok: false, error: 'owner_changed' });
    expect(snapshot()).toBe(before);
  });

  it('account switch while the start of the import is recorded: aborts, nothing written, marker cleared', async () => {
    let owner = 'user-a';
    const before = snapshot();
    const outcome = await applyLearningImport(
      parse(fileText()),
      'user-a',
      deps(() => owner, {
        markPending: async (pending) => {
          await AsyncStorage.setItem(PENDING_IMPORT_KEY, JSON.stringify(pending));
          owner = 'user-b';
          return true;
        },
      }),
    );
    expect(outcome).toEqual({ ok: false, error: 'owner_changed' });
    expect(snapshot()).toBe(before);
    expect(await AsyncStorage.getItem(PENDING_IMPORT_KEY)).toBeNull();
  });

  it('data lands only in the confirming owner\'s slice', async () => {
    await applyLearningImport(parse(fileText(undefined, { userId: 'user-b' })), 'user-a', deps('user-a'));
    expect(Object.keys(useReadingStore.getState().saved)).toEqual(['user-a']);
    expect(Object.keys(useListeningStore.getState().saved)).toEqual(['user-a']);
  });
});

describe('interrupted and partially failed imports', () => {
  it('cannot record the start: nothing is written', async () => {
    const before = snapshot();
    expect(await applyLearningImport(parse(fileText()), 'guest', deps('guest', { markPending: async () => false }))).toEqual({ ok: false, error: 'apply_failed' });
    expect(snapshot()).toBe(before);
  });

  it('success clears the marker; an app stop before that leaves it for the next visit (same owner only)', async () => {
    const text = fileText();
    await applyLearningImport(parse(text), 'guest', deps('guest'), { fingerprint: backupFingerprint(text) });
    expect(await readPendingImport('guest')).toBeNull();

    // "App killed" while the stores were still persisting: settle never finishes.
    __resetImportLockForTests();
    void applyLearningImport(parse(text), 'user-a', deps('user-a', { settle: () => new Promise(() => undefined) }), { fingerprint: backupFingerprint(text) });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(await readPendingImport('user-a')).toMatchObject({ owner: 'user-a', fingerprint: backupFingerprint(text) });
    expect(await readPendingImport('guest')).toBeNull();
    // The marker holds no backup contents.
    expect(await AsyncStorage.getItem(PENDING_IMPORT_KEY)).not.toMatch(/boz-uy|Tunduk|synthetic/);
    // Recovery: importing the same file again completes it and clears the marker.
    __resetImportLockForTests();
    const again = await applyLearningImport(parse(text), 'user-a', deps('user-a'));
    expect(again.ok).toBe(true);
  });

  it('a failed write is rolled back and reported as failed; a failed rollback is reported as partial and keeps the marker', async () => {
    const before = snapshot();
    const failing = (domain: string, alsoForget = false): StoreAdapter[] =>
      STORE_ADAPTERS.map((adapter) => ({
        ...adapter,
        load: async () => {},
        write: adapter.domain === domain ? () => { throw new Error('disk full'); } : adapter.write,
        forget: alsoForget ? () => { throw new Error('disk full'); } : adapter.forget,
      }));
    expect(await applyLearningImport(parse(fileText()), 'guest', deps('guest', { adapters: failing('weekly_goal') }))).toEqual({ ok: false, error: 'apply_failed' });
    expect(snapshot()).toBe(before);
    expect(await readPendingImport('guest')).toBeNull();

    expect(await applyLearningImport(parse(fileText()), 'guest', deps('guest', { adapters: failing('weekly_goal', true) }))).toEqual({ ok: false, error: 'apply_partial' });
    expect(await readPendingImport('guest')).not.toBeNull();
  });
});

describe('privacy', () => {
  it('analytics carry only schema version and domain count; nothing is logged', () => {
    const dir = __dirname;
    for (const file of ['ImportBackupScreen.tsx', 'applyLearningImport.ts', 'learningImport.ts', 'pickBackupFile.ts']) {
      const code = fs.readFileSync(path.join(dir, file), 'utf8');
      expect(code).not.toMatch(/console\.|Sentry|captureException/);
      for (const call of code.match(/track\([^)]*\)/g) ?? []) expect(call).toMatch(/track\('data_import_(started|completed|failed)', (props|\{ schema_version: 0, domain_count: 0 \})\)/);
    }
  });
});
