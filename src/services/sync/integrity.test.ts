/**
 * Cross-device data-integrity edge cases: versioned journal photos,
 * per-account photo folders, account stashes, and stale syncs that finish
 * after the account changed. Runs the real stores / sync engine / photo
 * helpers against an in-memory fake of Supabase (tables, RPCs, private
 * storage) and the expo-file-system in-memory mock.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onlineManager } from '@tanstack/react-query';
import { File, Paths } from 'expo-file-system';

import { useChallengeStore } from '@/store/useChallengeStore';
import { useDailyDiscoveryStore } from '@/store/useDailyDiscoveryStore';
import { useFavoritesStore } from '@/store/useFavoritesStore';
import { useJournalStore } from '@/store/useJournalStore';
import { useProgressStore } from '@/store/useProgressStore';
import { useWallpaperFavoritesStore } from '@/store/useWallpaperFavoritesStore';
import { deleteLocalPhoto, isInOwnerFolder, sanitizeOwner, staleVersionsToDelete } from '@/services/journal/journalPhotos';

import { __setSignOutSyncTimeoutForTests, beforeSignOut, onAccountSignedIn } from './accountLifecycle';
import { ACCOUNT_OWNER_KEY } from './accountScope';
import { __resetSyncEngineForTests, invalidateActiveSync, syncAccountState } from './syncEngine';

// ---------------------------------------------------------------------
// Fake backend
// ---------------------------------------------------------------------

type Row = Record<string, unknown>;
type Account = { daily: Map<string, string>; favorites: Map<string, string>; journal: Map<string, Row>; visits: Map<string, string> };

const mockBackend = {
  accounts: new Map<string, Account>(),
  objects: new Map<string, { createdAt: string }>(),
  uploads: [] as string[],
  removed: [] as string[],
  /** While set, every response waits for it (a slow network). */
  gate: null as Promise<void> | null,
  account(userId: string): Account {
    if (!this.accounts.has(userId)) this.accounts.set(userId, { daily: new Map(), favorites: new Map(), journal: new Map(), visits: new Map() });
    return this.accounts.get(userId)!;
  },
};

const mockAuth: { status: string; user: { id: string } | null } = { status: 'guest', user: null };

jest.mock('@/store/useAuthStore', () => ({ useAuthStore: { getState: () => mockAuth }, registerAccountHooks: jest.fn() }));
jest.mock('@/services/analytics/analytics', () => ({ track: jest.fn() }));

jest.mock('@/services/supabase/client', () => {
  const ok = (data: unknown) => ({ data, error: null });
  const later = <T,>(value: T) => (mockBackend.gate ?? Promise.resolve()).then(() => value);
  const progressRow = {
    xp: 0, coins: 0, gems: 0, games_played: 0, games_won: 0, streak_days: 0, wins_today: 0, plays_today: 0,
    daily_challenge_claimed_date: null, daily_gift_claimed_date: null, daily_play_claimed_date: null, quiz_claimed_date: null,
    quest_found_count: 0, quest_completed: false, boz_uy_visited: false, culture_discovery_count: 0,
    oymo_created: false, shyrdak_created: false, komuz_lesson_completed: false,
  };
  function rows(table: string) {
    // The server answers for the session that SENT the request.
    const account = mockBackend.account(mockAuth.user!.id);
    switch (table) {
      case 'user_daily_completions':
        return ok([...account.daily].map(([date_key, item_id]) => ({ date_key, item_id })));
      case 'user_favorites':
        return ok([...account.favorites].map(([key, created_at]) => ({ target_type: key.split(':')[0], target_id: key.slice(key.indexOf(':') + 1), created_at })));
      case 'user_journal_entries':
        return ok([...account.journal.values()]);
      case 'user_region_visits':
        return ok([...account.visits].map(([region_id, visited_at]) => ({ region_id, visited_at })));
      case 'user_progress':
        return ok(progressRow);
      default:
        return ok([]);
    }
  }
  return {
    supabase: {
      from: (table: string) => ({
        select: () => {
          const response = rows(table);
          return { then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => later(response).then(resolve, reject), single: () => later(response) };
        },
        insert: () => Promise.resolve(ok(null)),
      }),
      rpc: (fn: string, args: Record<string, unknown>) => {
        const account = mockBackend.account(mockAuth.user!.id);
        if (fn === 'merge_journal_entries') {
          for (const item of args.p_items as Row[]) {
            const existing = account.journal.get(item.id as string);
            if (!existing || (item.updated_at as string) > (existing.updated_at as string)) account.journal.set(item.id as string, { ...item });
          }
          return later(ok([...account.journal.values()]));
        }
        if (fn === 'merge_daily_completions') {
          for (const item of args.p_items as { date_key: string; item_id: string }[]) if (!account.daily.has(item.date_key)) account.daily.set(item.date_key, item.item_id);
          return later(ok([...account.daily].map(([date_key, item_id]) => ({ date_key, item_id }))));
        }
        return later(ok([]));
      },
      storage: {
        from: () => ({
          upload: async (path: string, _bytes: unknown, options: { upsert?: boolean }) => {
            if (mockBackend.objects.has(path) && !options.upsert) return { data: null, error: { message: 'The resource already exists' } };
            mockBackend.objects.set(path, { createdAt: new Date().toISOString() });
            mockBackend.uploads.push(path);
            return { data: { path }, error: null };
          },
          list: async (folder: string) => ({
            data: [...mockBackend.objects]
              .filter(([path]) => path.startsWith(`${folder}/`) && !path.slice(folder.length + 1).includes('/'))
              .map(([path, meta]) => ({ name: path.slice(folder.length + 1), created_at: meta.createdAt })),
            error: null,
          }),
          remove: async (paths: string[]) => {
            for (const path of paths) mockBackend.objects.delete(path);
            mockBackend.removed.push(...paths);
            return { data: null, error: null };
          },
          createSignedUrl: async (path: string) => ({ data: mockBackend.objects.has(path) ? { signedUrl: `https://signed.example/${path}` } : null, error: mockBackend.objects.has(path) ? null : { message: 'not found' } }),
        }),
      },
    },
  };
});

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

let pickCounter = 0;
function pickedImage(): string {
  pickCounter += 1;
  const file = new File(Paths.cache, `picked-${pickCounter}.jpg`);
  file.create();
  file.write(`image-${pickCounter}`);
  return file.uri;
}

function fileExists(uri: string | null | undefined): boolean {
  return !!uri && new File(uri).exists;
}

function signInAs(userId: string) {
  mockAuth.status = 'authenticated';
  mockAuth.user = { id: userId };
}

function becomeGuest() {
  mockAuth.status = 'guest';
  mockAuth.user = null;
}

const DAY = 24 * 60 * 60 * 1000;
const ENTRY_ID = '11111111-2222-4333-8444-555555555555';
const VERSION_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const VERSION_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function draft(title: string, photoUri: string | null) {
  return { title, note: `${title} note`, date: '2026-09-20', photoUri, link: null };
}

beforeAll(() => {
  (globalThis as { fetch?: unknown }).fetch = jest.fn(async (uri: string) => ({ arrayBuffer: async () => new TextEncoder().encode(String(uri)).buffer }));
});

beforeEach(async () => {
  mockBackend.accounts.clear();
  mockBackend.objects.clear();
  mockBackend.uploads = [];
  mockBackend.removed = [];
  mockBackend.gate = null;
  onlineManager.setOnline(true);
  __resetSyncEngineForTests();
  __setSignOutSyncTimeoutForTests(5000);
  becomeGuest();
  await AsyncStorage.clear();
  useJournalStore.setState({ entries: [], isLoaded: false });
  useDailyDiscoveryStore.setState({ completions: {}, isLoaded: false });
  useChallengeStore.setState({ daily: null, results: {}, isLoaded: false });
  useFavoritesStore.setState({ favoriteIds: [], isLoaded: false });
  useWallpaperFavoritesStore.setState({ ids: [], isLoaded: false });
  useProgressStore.setState({ visitedRegionIds: [], regionVisitDates: {}, isLoaded: false });
});

// ---------------------------------------------------------------------
// Journal photo versioning
// ---------------------------------------------------------------------

describe('versioned journal photos', () => {
  it("a stale device's older edit + photo never overwrites a newer version's photo", async () => {
    const userId = 'user-a';
    const pathB = `${userId}/${ENTRY_ID}/${VERSION_B}.jpg`;
    // Device B (11:00) already synced its newer version + photo B.
    mockBackend.objects.set(pathB, { createdAt: '2026-09-23T11:00:00.000Z' });
    mockBackend.account(userId).journal.set(ENTRY_ID, {
      id: ENTRY_ID, title: 'B title', note: 'B text', memory_date: '2026-09-20', link_type: null, link_id: null, link_label: null,
      photo_path: pathB, created_at: '2026-09-23T09:00:00.000Z', updated_at: '2026-09-23T11:00:00.000Z', deleted_at: null,
    });

    // Device A reconnects with its older (10:00) edit and photo A.
    signInAs(userId);
    await AsyncStorage.setItem(ACCOUNT_OWNER_KEY, userId);
    const photoA = pickedImage();
    useJournalStore.setState({
      isLoaded: true,
      entries: [{
        id: ENTRY_ID, title: 'A title', note: 'A text', date: '2026-09-20', link: null,
        photo: { localUri: photoA, remotePath: null, versionId: VERSION_A },
        createdAt: '2026-09-23T09:00:00.000Z', updatedAt: '2026-09-23T10:00:00.000Z', deletedAt: null,
      }],
    });

    const report = await syncAccountState('reconnect');

    expect(report.ok).toBe(true);
    // A's photo was never uploaded, B's stays referenced and stored.
    expect(mockBackend.uploads).toEqual([]);
    expect(mockBackend.objects.has(pathB)).toBe(true);
    expect(mockBackend.account(userId).journal.get(ENTRY_ID)).toMatchObject({ note: 'B text', photo_path: pathB });
    // The device now shows B's text and B's photo.
    const [entry] = useJournalStore.getState().entries;
    expect(entry).toMatchObject({ note: 'B text', photo: { remotePath: pathB, versionId: VERSION_B } });
    expect(fileExists(entry.photo?.localUri)).toBe(true);
  });

  it('two photo versions on one entry are separate objects; the old one is cleaned up only after the grace period', async () => {
    signInAs('user-a');
    await onAccountSignedIn('user-a');
    const entry = (await useJournalStore.getState().create(draft('Lake', pickedImage())))!;
    await syncAccountState('local_change');
    const firstPath = useJournalStore.getState().entries[0].photo!.remotePath!;

    await useJournalStore.getState().update(entry.id, draft('Lake', pickedImage()));
    await syncAccountState('local_change');
    const secondPath = useJournalStore.getState().entries[0].photo!.remotePath!;

    expect(firstPath).not.toBe(secondPath);
    expect(firstPath).toMatch(new RegExp(`^user-a/${entry.id}/[0-9a-f-]{36}\\.jpg$`));
    expect(mockBackend.account('user-a').journal.get(entry.id)?.photo_path).toBe(secondPath);
    // Recent: both kept (another device may still be about to use one).
    expect(mockBackend.objects.has(firstPath)).toBe(true);

    // A day later the superseded version goes; the current one stays.
    mockBackend.objects.set(firstPath, { createdAt: new Date(Date.now() - 2 * DAY).toISOString() });
    mockBackend.objects.set(secondPath, { createdAt: new Date(Date.now() - 2 * DAY).toISOString() });
    await syncAccountState('app_start');
    expect(mockBackend.objects.has(firstPath)).toBe(false);
    expect(mockBackend.objects.has(secondPath)).toBe(true);
  });

  it('clean-up never deletes the referenced version, a fresh upload, or a version of unknown age', () => {
    const now = Date.parse('2026-09-24T12:00:00.000Z');
    const old = '2026-09-20T00:00:00.000Z';
    const folder = `user-a/${ENTRY_ID}`;
    const objects = [
      { name: `${VERSION_A}.jpg`, createdAt: old }, // referenced
      { name: `${VERSION_B}.jpg`, createdAt: old }, // superseded + old -> delete
      { name: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc.jpg', createdAt: '2026-09-24T11:59:00.000Z' }, // another device, just now
      { name: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd.jpg', createdAt: null }, // unknown
    ];
    expect(staleVersionsToDelete(objects, `${folder}/${VERSION_A}.jpg`, folder, now)).toEqual([`${folder}/${VERSION_B}.jpg`]);
  });

  it('a legacy <user>/<entry>.jpg photo still loads and is never re-uploaded or removed', async () => {
    const legacy = `user-a/${ENTRY_ID}.jpg`;
    mockBackend.objects.set(legacy, { createdAt: '2026-01-01T00:00:00.000Z' });
    mockBackend.account('user-a').journal.set(ENTRY_ID, {
      id: ENTRY_ID, title: 'Old', note: 'from an older app', memory_date: '2026-09-01', link_type: null, link_id: null, link_label: null,
      photo_path: legacy, created_at: '2026-09-01T00:00:00.000Z', updated_at: '2026-09-01T00:00:00.000Z', deleted_at: null,
    });

    signInAs('user-a');
    await onAccountSignedIn('user-a');
    await syncAccountState('app_start');

    const [entry] = useJournalStore.getState().entries;
    expect(entry.photo).toMatchObject({ remotePath: legacy, versionId: null });
    expect(fileExists(entry.photo?.localUri)).toBe(true);
    expect(mockBackend.uploads).toEqual([]);
    expect(mockBackend.objects.has(legacy)).toBe(true);
  });
});

// ---------------------------------------------------------------------
// Account-scoped local photo folders
// ---------------------------------------------------------------------

describe('account-scoped local photos', () => {
  it('owner folder names are sanitized and deletion stays inside the owner folder', () => {
    expect(sanitizeOwner('../user-b')).toBeNull();
    expect(sanitizeOwner('user-a/..')).toBeNull();
    expect(sanitizeOwner('guest')).toBe('guest');
    const other = new File(Paths.document, 'journal', 'user-b', 'x.jpg');
    expect(isInOwnerFolder(other.uri, 'user-a')).toBe(false);
    expect(isInOwnerFolder(other.uri, 'user-b')).toBe(true);
    // Asking user-a's helper to delete user-b's file does nothing.
    deleteLocalPhoto(other.uri, 'user-a');
  });

  it("a guest's photo survives sign-in and moves into the account's folder", async () => {
    await AsyncStorage.setItem(ACCOUNT_OWNER_KEY, 'guest');
    await useJournalStore.getState().load();
    const entry = (await useJournalStore.getState().create(draft('Guest memory', pickedImage())))!;
    const guestUri = entry.photo!.localUri!;
    expect(isInOwnerFolder(guestUri, 'guest')).toBe(true);

    signInAs('user-a');
    await onAccountSignedIn('user-a');

    const adopted = useJournalStore.getState().entries[0].photo!;
    expect(isInOwnerFolder(adopted.localUri, 'user-a')).toBe(true);
    expect(fileExists(adopted.localUri)).toBe(true);
    expect(fileExists(guestUri)).toBe(false);
    expect(adopted.remotePath).toBe(`user-a/${entry.id}/${adopted.versionId}.jpg`);
    expect(mockBackend.objects.has(adopted.remotePath!)).toBe(true);
  });

  it("Account A's stashed offline photo survives Account B signing in and out", async () => {
    // 1. A creates an entry + photo offline.
    signInAs('user-a');
    await onAccountSignedIn('user-a');
    onlineManager.setOnline(false);
    const entryA = (await useJournalStore.getState().create(draft('A offline', pickedImage())))!;
    const photoA = entryA.photo!.localUri!;

    // 2-4. A signs out; the sync can't complete, so A's state is stashed.
    await beforeSignOut('user-a');
    becomeGuest();
    expect(useJournalStore.getState().entries).toEqual([]);
    expect(fileExists(photoA)).toBe(true);

    // 5-7. B signs in (online), uses the Journal, signs out.
    onlineManager.setOnline(true);
    signInAs('user-b');
    await onAccountSignedIn('user-b');
    const entryB = (await useJournalStore.getState().create(draft('B memory', pickedImage())))!;
    await syncAccountState('local_change');
    await beforeSignOut('user-b');
    becomeGuest();
    expect(fileExists(entryB.photo?.localUri)).toBe(false); // B's own files are cleared...
    expect(fileExists(photoA)).toBe(true); // ...A's stashed photo is not.

    // 8. A signs back in: the offline entry and its photo are there and sync.
    signInAs('user-a');
    await onAccountSignedIn('user-a');
    const restored = useJournalStore.getState().entries.find((entry) => entry.id === entryA.id)!;
    expect(restored.title).toBe('A offline');
    expect(fileExists(restored.photo?.localUri)).toBe(true);
    expect(mockBackend.account('user-a').journal.get(entryA.id)?.photo_path).toBe(restored.photo?.remotePath);
    expect(mockBackend.account('user-b').journal.has(entryA.id)).toBe(false);
  });
});

// ---------------------------------------------------------------------
// Stale syncs
// ---------------------------------------------------------------------

function holdResponses(): () => void {
  let release!: () => void;
  mockBackend.gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  return () => {
    mockBackend.gate = null;
    release();
  };
}

function seedAccount(userId: string, tag: string) {
  const account = mockBackend.account(userId);
  account.daily.set('2026-09-10', `${tag}-daily`);
  account.favorites.set(`game:${tag}-game`, '2026-09-01T00:00:00.000Z');
  account.visits.set('son-kol', '2026-09-01T00:00:00.000Z');
  account.journal.set(ENTRY_ID, {
    id: ENTRY_ID, title: `${tag} private`, note: `${tag} note`, memory_date: '2026-09-10', link_type: null, link_id: null, link_label: null,
    photo_path: null, created_at: '2026-09-10T00:00:00.000Z', updated_at: '2026-09-10T00:00:00.000Z', deleted_at: null,
  });
}

function storesMention(tag: string): boolean {
  return JSON.stringify({
    daily: useDailyDiscoveryStore.getState().completions,
    favorites: useFavoritesStore.getState().favoriteIds,
    journal: useJournalStore.getState().entries,
  }).includes(tag);
}

describe('stale sync protection', () => {
  it('a sync still in flight at sign-out never writes the account back into the stores', async () => {
    seedAccount('user-a', 'alpha');
    signInAs('user-a');
    await AsyncStorage.setItem(ACCOUNT_OWNER_KEY, 'user-a');
    for (const store of [useDailyDiscoveryStore, useChallengeStore, useWallpaperFavoritesStore, useJournalStore] as const) await store.getState().load();

    const release = holdResponses();
    const slow = syncAccountState('foreground');
    __setSignOutSyncTimeoutForTests(20);
    await beforeSignOut('user-a'); // times out, invalidates, clears
    becomeGuest();
    await useProgressStore.getState().load();

    release();
    const report = await slow;
    const progressLoad = useProgressStore.getState().load();
    await progressLoad;

    expect(report.skipped).toBe('account_changed');
    expect(storesMention('alpha')).toBe(false);
    expect(useProgressStore.getState().visitedRegionIds).toEqual([]);
    expect(await AsyncStorage.getItem('oyno.journal.v1')).toBeNull();
    expect(await AsyncStorage.getItem('oyno.daily.completions')).toBeNull();
  });

  it("Account A's late response never reaches Account B", async () => {
    seedAccount('user-a', 'alpha');
    seedAccount('user-b', 'bravo');
    signInAs('user-a');
    await AsyncStorage.setItem(ACCOUNT_OWNER_KEY, 'user-a');
    for (const store of [useDailyDiscoveryStore, useChallengeStore, useWallpaperFavoritesStore, useJournalStore] as const) await store.getState().load();

    const release = holdResponses();
    const slowA = syncAccountState('foreground');
    const progressA = useProgressStore.getState().load();

    // B signs in on the same device while A's requests are still out.
    signInAs('user-b');
    const signInB = onAccountSignedIn('user-b');
    release();
    await Promise.all([slowA, progressA, signInB]);

    expect(storesMention('alpha')).toBe(false);
    expect(storesMention('bravo')).toBe(true);
    expect(useDailyDiscoveryStore.getState().completions).toEqual({ '2026-09-10': 'bravo-daily' });
  });

  it('invalidation discards a prior sync even for the same user, and the next sync works normally', async () => {
    seedAccount('user-a', 'alpha');
    signInAs('user-a');
    await AsyncStorage.setItem(ACCOUNT_OWNER_KEY, 'user-a');
    for (const store of [useDailyDiscoveryStore, useChallengeStore, useWallpaperFavoritesStore, useJournalStore] as const) await store.getState().load();

    const release = holdResponses();
    const stale = syncAccountState('foreground');
    invalidateActiveSync();
    release();
    expect((await stale).skipped).toBe('account_changed');
    expect(storesMention('alpha')).toBe(false);

    const fresh = await syncAccountState('reconnect');
    expect(fresh.ok).toBe(true);
    expect(storesMention('alpha')).toBe(true);
    expect(useProgressStore.getState().visitedRegionIds).toEqual(['son-kol']);
  });

  it('foreground sync after a normal start still applies server changes', async () => {
    signInAs('user-a');
    await onAccountSignedIn('user-a');
    mockBackend.account('user-a').daily.set('2026-09-22', 'from-other-phone');
    const report = await syncAccountState('foreground');
    expect(report.ok).toBe(true);
    expect(useDailyDiscoveryStore.getState().completions['2026-09-22']).toBe('from-other-phone');
  });
});
