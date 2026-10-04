import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import { STORE_ADAPTERS, type StoreAdapter } from '@/services/sync/privateSync/storeAdapters';
import { useChallengeMistakesStore } from '@/store/useChallengeMistakesStore';
import { useGameRecordsStore } from '@/store/useGameRecordsStore';
import { useHighlightsStore } from '@/store/useHighlightsStore';
import { useMyCollectionsStore } from '@/store/useMyCollectionsStore';
import { useReadingStore } from '@/store/useReadingStore';
import { useWeeklyGoalStore } from '@/store/useWeeklyGoalStore';

import { applyLearningImport, type ImportDeps } from './applyLearningImport';
import { buildLearningExport, type LearningExportInput } from './learningExport';
import { MAX_FILE_BYTES, parseLearningBackup, planDomain, type ParsedBackup } from './learningImport';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));
jest.mock('@/services/analytics/analytics', () => ({ track: jest.fn() }));
jest.mock('@/store/useAuthStore', () => ({ useAuthStore: { getState: () => ({ status: 'guest', user: null }) }, registerAccountHooks: jest.fn() }));

const T1 = '2026-09-01T10:00:00.000Z';
const T2 = '2026-09-20T10:00:00.000Z';
const NOW = new Date('2026-10-01T12:00:00.000Z');

const input = (over: Partial<LearningExportInput> = {}): LearningExportInput => ({
  reading: { 'culture_item:boz-uy-overview': { contentType: 'culture_item', contentId: 'boz-uy-overview', progress: 0.4, furthest: 0.6, lastReadAt: T1, completedAt: null } },
  highlights: {},
  collections: { collections: [{ id: 'uc_a', name: 'Felt', description: null, createdAt: T1, updatedAt: T1 }], items: [{ collectionId: 'uc_a', contentType: 'culture_item', contentId: 'shyrdak-craft', sortOrder: 0, addedAt: T1 }] },
  mistakes: { active: { 'tunduk-flag': { questionId: 'tunduk-flag', firstWrongAt: T1, lastWrongAt: T1, wrongCount: 2 } }, reviewedAt: {} },
  glossaryStudy: { tunduk: { glossaryEntryId: 'tunduk', seenCount: 3, gotItCount: 1, reviewAgainCount: 2, lastReviewedAt: T1, needsReview: true } },
  glossarySessions: [T1],
  gameRecords: { recent: {}, best: { jaa_atuu: 120 }, sessions: { jaa_atuu: 4 }, wins: {} },
  komuzFavorites: ['ak-maral-min'],
  pathSteps: { 'boz-uy': { build: T1 } },
  listening: { history: {}, bookmarks: {} },
  weeklyGoal: 5,
  ...over,
});
const fileOf = (over: Partial<LearningExportInput> = {}, extra: Record<string, unknown> = {}) => JSON.stringify({ ...buildLearningExport(input(over), NOW), ...extra });
const parsed = (text: string): ParsedBackup => {
  const result = parseLearningBackup(text);
  if (!result.ok) throw new Error(result.error);
  return result.backup;
};

describe('stage 1: parse + validate', () => {
  it('accepts OYNO exports (current and the earlier format-only v1) and counts reliably', () => {
    const backup = parsed(fileOf());
    expect(backup.version).toBe(1);
    expect(backup.counts).toEqual({ reading: 1, collections: 1, mistakes: 1, glossary: 1, games: 1, komuz: 1, pathSteps: 1, weeklyGoal: 1 });
    const legacy = JSON.parse(fileOf());
    delete legacy.schema;
    delete legacy.version;
    delete legacy.domains;
    expect(parseLearningBackup(JSON.stringify(legacy)).ok).toBe(true);
  });

  it('rejects malformed JSON, wrong schema, arbitrary JSON, newer versions, huge files, unknown domains', () => {
    expect(parseLearningBackup('{not json')).toEqual({ ok: false, error: 'malformed' });
    expect(parseLearningBackup('[1,2]')).toEqual({ ok: false, error: 'wrong_schema' });
    expect(parseLearningBackup(JSON.stringify({ hello: 'world' }))).toEqual({ ok: false, error: 'wrong_schema' });
    expect(parseLearningBackup(JSON.stringify({ ...JSON.parse(fileOf()), version: 2 }))).toEqual({ ok: false, error: 'newer_version' });
    expect(parseLearningBackup('x'.repeat(10), MAX_FILE_BYTES + 1)).toEqual({ ok: false, error: 'too_large' });
    expect(parseLearningBackup(fileOf({}, { journal: [] }))).toEqual({ ok: false, error: 'invalid' });
    expect(parseLearningBackup(JSON.stringify({ ...JSON.parse(fileOf()), exportedAt: 'yesterday' }))).toEqual({ ok: false, error: 'wrong_schema' });
  });

  it('rejects malicious keys, oversized arrays/strings and bad ids (whole file, nothing partial)', () => {
    const base = JSON.parse(fileOf());
    expect(parseLearningBackup(fileOf().replace('"readingProgress"', '"__proto__":{"polluted":true},"readingProgress"')).ok).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(parseLearningBackup(JSON.stringify({ ...base, komuzFavorites: Array.from({ length: 6000 }, (_, i) => `t${i}`) })).ok).toBe(false);
    expect(parseLearningBackup(JSON.stringify({ ...base, komuzFavorites: ['../../etc'] })).ok).toBe(false);
    expect(parseLearningBackup(JSON.stringify({ ...base, komuzFavorites: ['a'.repeat(6000)] })).ok).toBe(false);
    const badReading = { ...base, readingProgress: [{ ...base.readingProgress[0], furthest: 'lots' }] };
    expect(parseLearningBackup(JSON.stringify(badReading))).toEqual({ ok: false, error: 'invalid' });
  });

  it('never imports auth / identity keys - they are ignored and reported', () => {
    const backup = parsed(fileOf({}, { accessToken: 'secret', session: { refresh_token: 'x' }, email: 'a@b.c', userId: 'someone-else', ownerId: 'x' }));
    expect(backup.ignoredKeys.sort()).toEqual(['accessToken', 'email', 'ownerId', 'session', 'userId']);
    expect(JSON.stringify(backup.records)).not.toMatch(/secret|refresh_token|a@b\.c|someone-else/);
  });

  it('flags private highlight notes so the person confirms', () => {
    const highlight = { id: 'h', contentType: 'culture_item' as const, contentId: 'boz-uy-tunduk', sectionKey: 'history', language: 'en', titleSnapshot: 'Tunduk', excerptSnapshot: 'text', note: 'my note', createdAt: T1, updatedAt: T1 };
    expect(parsed(fileOf({ highlights: { h: highlight } })).hasPrivateNotes).toBe(true);
    expect(parsed(fileOf({ highlights: { h: { ...highlight, note: null } } })).hasPrivateNotes).toBe(false);
  });
});

describe('stage 2: merge plan reuses the Private Cloud Sync rules', () => {
  const backup = parsed(fileOf());

  it('reading: furthest wins, completion preserved', () => {
    const current = { 'culture_item:boz-uy-overview': { contentType: 'culture_item', contentId: 'boz-uy-overview', progress: 0.9, furthest: 0.9, lastReadAt: T2, completedAt: T2 } };
    const plan = planDomain('reading', current, backup.records.reading!);
    expect(plan.next['culture_item:boz-uy-overview']).toMatchObject({ furthest: 0.9, completedAt: T2 });
  });

  it('mistakes merge by question id; counters never add up twice; weekly goal: newest choice wins', () => {
    const current = { 'tunduk-flag': { questionId: 'tunduk-flag', active: { questionId: 'tunduk-flag', firstWrongAt: T1, lastWrongAt: T1, wrongCount: 2 }, reviewedAt: null } };
    expect((planDomain('mistakes', current, backup.records.mistakes!).next['tunduk-flag'] as { active: { wrongCount: number } }).active.wrongCount).toBe(2);
    const games = planDomain('game_records', { jaa_atuu: { best: 100, recent: [], sessions: 6, wins: 0 } }, backup.records.game_records!);
    expect(games.next.jaa_atuu).toMatchObject({ best: 120, sessions: 6 });
    expect(planDomain('weekly_goal', { goal: { goal: 3, setAt: T2 } }, { goal: { goal: 5, setAt: T1 } }).next.goal).toEqual({ goal: 3, setAt: T2 });
    expect(planDomain('weekly_goal', { goal: { goal: 3, setAt: T1 } }, { goal: { goal: 5, setAt: T2 } }).next.goal).toEqual({ goal: 5, setAt: T2 });
  });

  it('collections: identity-safe union onto the existing collection (no duplicate)', () => {
    const current = { uc_a: { collection: { id: 'uc_a', name: 'Felt', description: 'mine', createdAt: T1, updatedAt: T2 }, items: [{ contentType: 'culture_item', contentId: 'oymo-overview', sortOrder: 0, addedAt: T2 }] } };
    const plan = planDomain('collections', current, backup.records.collections!);
    expect(Object.keys(plan.next)).toEqual(['uc_a']);
    const merged = plan.next.uc_a as { collection: { description: string }; items: { contentId: string }[] };
    expect(merged.collection.description).toBe('mine');
    expect(merged.items.map((item) => item.contentId).sort()).toEqual(['oymo-overview', 'shyrdak-craft']);
  });

  it('a record the account deleted (tombstone) is not resurrected', () => {
    const plan = planDomain('komuz_favorites', {}, backup.records.komuz_favorites!, new Set(['ak-maral-min']));
    expect(plan.next).toEqual({});
    expect(plan.skippedDeleted).toBe(1);
  });
});

describe('apply: owner safety, atomicity, idempotency, cloud honesty', () => {
  const reset = () => {
    for (const store of [useReadingStore, useHighlightsStore, useMyCollectionsStore, useChallengeMistakesStore, useGameRecordsStore, useWeeklyGoalStore] as unknown as { setState: (state: unknown) => void }[]) store.setState({ saved: {}, isLoaded: true });
  };
  const deps = (owner: string, over: Partial<ImportDeps> = {}): ImportDeps => ({ owner: () => owner, adapters: STORE_ADAPTERS.map((adapter) => ({ ...adapter, load: async () => {} })), deletedKeys: async () => ({}), cloud: () => (owner === 'guest' ? 'device_only_guest' : 'cloud_unavailable'), requestSync: jest.fn(), ...over });
  beforeEach(reset);

  it('imports into the CURRENT owner only (guest), never the id in the file; second import changes nothing', async () => {
    const backup = parsed(fileOf({}, { userId: 'account-b' }));
    const first = await applyLearningImport(backup, 'guest', deps('guest'));
    expect(first.ok && first.cloud).toBe('device_only_guest');
    expect(Object.keys(useReadingStore.getState().saved)).toEqual(['guest']);
    expect(useReadingStore.getState().saved['account-b']).toBeUndefined();
    const snapshot = JSON.stringify([useReadingStore.getState().saved, useMyCollectionsStore.getState().saved, useGameRecordsStore.getState().saved, useChallengeMistakesStore.getState().saved]);
    const second = await applyLearningImport(backup, 'guest', deps('guest'));
    expect(second.ok && second.domains).toEqual([]);
    expect(JSON.stringify([useReadingStore.getState().saved, useMyCollectionsStore.getState().saved, useGameRecordsStore.getState().saved, useChallengeMistakesStore.getState().saved])).toBe(snapshot);
  });

  it('account A / B isolation and an owner switch between preview and import aborts', async () => {
    const backup = parsed(fileOf());
    await applyLearningImport(backup, 'user-a', deps('user-a'));
    expect(useReadingStore.getState().saved['user-a']).toBeDefined();
    expect(useReadingStore.getState().saved['user-b']).toBeUndefined();
    expect(await applyLearningImport(backup, 'user-a', deps('user-b'))).toEqual({ ok: false, error: 'owner_changed' });
  });

  it('cloud unavailable is reported honestly; sync is requested only when available', async () => {
    const backup = parsed(fileOf());
    const unavailable = deps('user-a');
    expect((await applyLearningImport(backup, 'user-a', unavailable)).ok && 'yes').toBe('yes');
    expect(unavailable.requestSync).not.toHaveBeenCalled();
    reset();
    const available = deps('user-a', { cloud: () => 'will_sync' });
    const outcome = await applyLearningImport(backup, 'user-a', available);
    expect(outcome.ok && outcome.cloud).toBe('will_sync');
    expect(available.requestSync).toHaveBeenCalledTimes(1);
  });

  it('atomic: a failing write restores every domain already written', async () => {
    useReadingStore.setState({ saved: { guest: {} } } as never);
    const before = JSON.stringify([useReadingStore.getState().saved, useMyCollectionsStore.getState().saved]);
    const adapters: StoreAdapter[] = STORE_ADAPTERS.map((adapter) => ({ ...adapter, load: async () => {}, write: adapter.domain === 'game_records' ? () => { throw new Error('disk full'); } : adapter.write }));
    const outcome = await applyLearningImport(parsed(fileOf()), 'guest', deps('guest', { adapters }));
    expect(outcome).toEqual({ ok: false, error: 'apply_failed' });
    expect(JSON.stringify([useReadingStore.getState().saved, useMyCollectionsStore.getState().saved])).toBe(before);
  });
});

describe('wiring', () => {
  const root = path.join(__dirname, '../../../..');
  const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
  it('route, entry, analytics without contents, KG/RU/EN', () => {
    expect(fs.existsSync(path.join(root, 'src/app/settings/data-privacy/import.tsx'))).toBe(true);
    expect(read('src/features/settings/dataPrivacy/DataPrivacyScreen.tsx')).toContain("'/settings/data-privacy/import'");
    const screen = read('src/features/settings/dataPrivacy/ImportBackupScreen.tsx');
    expect(screen).toContain('const props = { schema_version: backup.version, domain_count: Object.keys(backup.records).length }');
    for (const name of ['data_import_started', 'data_import_completed', 'data_import_failed']) expect(read('src/services/analytics/analytics.ts')).toContain(`'${name}'`);
    for (const locale of [en, ru, kg]) {
      const section = (locale as Record<string, Record<string, unknown>>).dataImport;
      for (const key of ['title', 'intro', 'privateNotes', 'apply', 'doneTitle']) expect(section[key]).toBeTruthy();
      expect((section.errors as Record<string, string>).newer_version).toBeTruthy();
    }
    expect((en.dataImport.errors as Record<string, string>).newer_version).toContain('newer OYNO version');
  });
});
