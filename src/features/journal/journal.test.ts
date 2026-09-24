import AsyncStorage from '@react-native-async-storage/async-storage';
import fs from 'fs';
import path from 'path';

import { track } from '@/services/analytics/analytics';
import { useChallengeStore } from '@/store/useChallengeStore';
import { useDailyDiscoveryStore } from '@/store/useDailyDiscoveryStore';
import { useFavoritesStore } from '@/store/useFavoritesStore';
import { JOURNAL_STORAGE_KEY, useJournalStore } from '@/store/useJournalStore';
import { useProgressStore } from '@/store/useProgressStore';

import { groupByMonth, isValidJournalLink, mergeJournalEntries, rememberCultureItemId, shareExcerpt, validateDraft, visibleEntries, type JournalDraft, type JournalEntry } from './journalModel';

jest.mock('@/services/analytics/analytics', () => ({ track: jest.fn() }));
jest.mock('@/services/supabase/client', () => ({ supabase: { rpc: jest.fn(), from: jest.fn(), storage: { from: jest.fn() } } }));
jest.mock('@/store/useAuthStore', () => ({ useAuthStore: { getState: () => ({ status: 'guest', user: null }) }, registerAccountHooks: jest.fn() }));

const mockOrigin = { value: 'guest' as 'guest' | 'account' };
jest.mock('@/services/sync/syncTrigger', () => ({
  requestAccountSync: jest.fn(),
  currentEditOrigin: () => mockOrigin.value,
  registerSyncScheduler: jest.fn(),
}));

const PRIVATE_NOTE = 'My secret thought about the lake 7f3k';

function draft(overrides: Partial<JournalDraft> = {}): JournalDraft {
  return { title: 'Morning at Son-Köl', note: PRIVATE_NOTE, date: '2026-09-20', photoUri: null, link: { type: 'nature_site', id: 'son-kol', label: 'Son-Köl' }, ...overrides };
}

beforeEach(async () => {
  await AsyncStorage.clear();
  mockOrigin.value = 'guest';
  (track as jest.Mock).mockClear();
  useJournalStore.setState({ entries: [], isLoaded: true });
});

describe('journal entries', () => {
  it('creates an entry with the note kept exactly as written', async () => {
    const entry = await useJournalStore.getState().create(draft({ note: '  Кечинде   көл тынч эле.\nЖакшы!  ' }));
    expect(entry).not.toBeNull();
    expect(entry!.note).toBe('  Кечинде   көл тынч эле.\nЖакшы!  ');
    expect(visibleEntries(useJournalStore.getState().entries)).toHaveLength(1);
  });

  it('edits the note, the photo and removes the linked content', async () => {
    const entry = (await useJournalStore.getState().create(draft()))!;
    const updated = await useJournalStore.getState().update(entry.id, draft({ note: 'Changed', link: null, title: 'New title' }));
    expect(updated).toMatchObject({ note: 'Changed', link: null, title: 'New title' });
    expect(updated!.updatedAt >= entry.updatedAt).toBe(true);
  });

  it('refuses an empty memory', async () => {
    expect(await useJournalStore.getState().create(draft({ title: '', note: '', link: null }))).toBeNull();
    expect(validateDraft(draft({ title: '', note: '  ', link: null }))).toContain('empty');
  });

  it("deletes a guest's entry outright", async () => {
    const entry = (await useJournalStore.getState().create(draft()))!;
    await useJournalStore.getState().remove(entry.id);
    expect(useJournalStore.getState().entries).toEqual([]);
  });

  it("wipes an account entry's private text at once and keeps a tombstone for sync", async () => {
    mockOrigin.value = 'account';
    const entry = (await useJournalStore.getState().create(draft()))!;
    await useJournalStore.getState().remove(entry.id);
    const [tombstone] = useJournalStore.getState().entries;
    expect(tombstone.deletedAt).not.toBeNull();
    expect(tombstone.note).toBe('');
    expect(tombstone.title).toBe('');
    expect(visibleEntries(useJournalStore.getState().entries)).toEqual([]);
  });

  it('persists locally and survives a reload', async () => {
    await useJournalStore.getState().create(draft());
    useJournalStore.setState({ entries: [], isLoaded: false });
    await useJournalStore.getState().load();
    expect(useJournalStore.getState().entries[0].title).toBe('Morning at Son-Köl');
    // Photos are files; nothing large goes into AsyncStorage.
    const raw = (await AsyncStorage.getItem(JOURNAL_STORAGE_KEY))!;
    expect(raw).not.toMatch(/data:image|base64/);
  });
});

describe('linked content validation', () => {
  it('accepts only real OYNO content of the supported types', () => {
    expect(isValidJournalLink({ type: 'nature_site', id: 'son-kol' })).toBe(true);
    expect(isValidJournalLink({ type: 'collection', id: 'horse-culture' })).toBe(true);
    expect(isValidJournalLink({ type: 'trail', id: 'nomad-life' })).toBe(true);
    expect(isValidJournalLink({ type: 'culture_item', id: 'boz-uy-tunduk' })).toBe(true);

    expect(isValidJournalLink({ type: 'nature_site', id: 'atlantis' })).toBe(false);
    expect(isValidJournalLink({ type: 'trail', id: 'nope' })).toBe(false);
    expect(isValidJournalLink({ type: 'game', id: 'ordo' })).toBe(false);
    expect(isValidJournalLink({ type: 'culture_item', id: '../../etc' })).toBe(false);
    expect(isValidJournalLink({ type: 'culture_item', id: 'db-only-item' })).toBe(false);
  });

  it('a culture item opened on its detail screen becomes linkable', () => {
    rememberCultureItemId('db-only-item');
    expect(isValidJournalLink({ type: 'culture_item', id: 'db-only-item' })).toBe(true);
  });

  it('rejects a bad link in a draft', async () => {
    expect(await useJournalStore.getState().create(draft({ link: { type: 'nature_site', id: 'atlantis', label: 'x' } }))).toBeNull();
  });
});

describe('journal is separate personal content', () => {
  it('creating and deleting entries never changes progress, favorites, challenges or Daily', async () => {
    const before = JSON.stringify({
      visits: useProgressStore.getState().visitedRegionIds,
      achievements: useProgressStore.getState().unlockedAchievementIds,
      favorites: useFavoritesStore.getState().favoriteIds,
      challenges: useChallengeStore.getState().results,
      daily: useDailyDiscoveryStore.getState().completions,
    });
    const entry = (await useJournalStore.getState().create(draft()))!;
    await useJournalStore.getState().update(entry.id, draft({ note: 'x' }));
    await useJournalStore.getState().remove(entry.id);
    const after = JSON.stringify({
      visits: useProgressStore.getState().visitedRegionIds,
      achievements: useProgressStore.getState().unlockedAchievementIds,
      favorites: useFavoritesStore.getState().favoriteIds,
      challenges: useChallengeStore.getState().results,
      daily: useDailyDiscoveryStore.getState().completions,
    });
    expect(after).toBe(before);
    // Only the journal's own key was written.
    const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith('oyno.'));
    expect(keys).toEqual([JOURNAL_STORAGE_KEY]);
  });

  it('private journal text never reaches analytics', async () => {
    const entry = (await useJournalStore.getState().create(draft()))!;
    await useJournalStore.getState().update(entry.id, draft({ note: `${PRIVATE_NOTE} edited` }));
    await useJournalStore.getState().remove(entry.id);
    expect(track).not.toHaveBeenCalled();
    expect(JSON.stringify((track as jest.Mock).mock.calls)).not.toContain('7f3k');
  });

  it('private journal content is never part of Search', () => {
    // Search is built only from the content catalog; neither the catalog,
    // the search service nor the Search screen can see the journal.
    const root = path.resolve(__dirname, '../..');
    const searchSources = [
      'services/content/contentCatalog.ts',
      'services/search/globalSearch.ts',
      'services/search/recentSearches.ts',
      'features/search',
    ];
    const walk = (target: string): string[] =>
      fs.statSync(target).isDirectory() ? fs.readdirSync(target).flatMap((name) => walk(path.join(target, name))) : [target];
    for (const relative of searchSources) {
      for (const file of walk(path.join(root, relative))) {
        if (!/\.tsx?$/.test(file)) continue;
        expect(fs.readFileSync(file, 'utf8')).not.toMatch(/journal/i);
      }
    }
  });
});

describe('merge and timeline', () => {
  const base: JournalEntry = {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'A',
    note: 'first',
    date: '2026-09-01',
    photo: null,
    link: null,
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    deletedAt: null,
  };

  it('newest edit wins; a delete wins over an older edit', () => {
    const edited = { ...base, note: 'second', updatedAt: '2026-09-02T10:00:00.000Z' };
    expect(mergeJournalEntries([base], [edited]).merged[0].note).toBe('second');
    const deleted = { ...base, title: '', note: '', deletedAt: '2026-09-03T10:00:00.000Z', updatedAt: '2026-09-03T10:00:00.000Z' };
    expect(mergeJournalEntries([edited], [deleted]).merged[0].deletedAt).not.toBeNull();
  });

  it('groups entries by month, newest first, and hides tombstones', () => {
    const entries = [
      { ...base, id: 'a', date: '2026-08-30' },
      { ...base, id: 'b', date: '2026-09-12' },
      { ...base, id: 'c', date: '2026-09-02', deletedAt: '2026-09-05T00:00:00.000Z' },
    ];
    expect(groupByMonth(visibleEntries(entries)).map((group) => [group.month, group.entries.map((entry) => entry.id)])).toEqual([
      ['2026-09', ['b']],
      ['2026-08', ['a']],
    ]);
  });

  it('filters by linked content type', () => {
    const entries = [
      { ...base, id: 'p', link: { type: 'nature_site' as const, id: 'son-kol', label: '' } },
      { ...base, id: 'c', link: { type: 'culture_item' as const, id: 'boz-uy-tunduk', label: '' } },
      { ...base, id: 't', link: { type: 'trail' as const, id: 'nomad-life', label: '' } },
    ];
    expect(visibleEntries(entries, 'places').map((entry) => entry.id)).toEqual(['p']);
    expect(visibleEntries(entries, 'culture').map((entry) => entry.id)).toEqual(['c']);
    expect(visibleEntries(entries, 'trails').map((entry) => entry.id)).toEqual(['t']);
  });

  it('a shared card only ever carries the short line the user typed', () => {
    expect(shareExcerpt('   ')).toBe('');
    expect(shareExcerpt('x'.repeat(500))).toHaveLength(140);
  });
});
