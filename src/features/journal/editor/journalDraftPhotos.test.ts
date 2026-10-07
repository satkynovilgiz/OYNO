/**
 * Journal drafts as a complete writing-and-photo recovery flow, on the
 * in-memory expo-file-system (real File objects, a fake disk). Native
 * photo pickers, real cache purges and app kills are device checks.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';

import * as journalPhotos from '@/services/journal/journalPhotos';
import { bumpAccountGeneration } from '@/services/sync/accountGeneration';
import { clearAccountBoundState } from '@/services/sync/accountScope';
import { JOURNAL_DRAFTS_KEY, journalDraftCleanupSettled, useJournalDraftStore } from '@/store/useJournalDraftStore';
import { JournalSaveError, useJournalStore } from '@/store/useJournalStore';

import type { JournalEntry } from '../journalModel';
import { baselineForEntry, baselineForNew, makeDraft, restoredFields, restoreOffer, type EditorFields } from './editorDraft';

jest.mock('@/services/supabase/client', () => ({ supabase: { rpc: jest.fn(), from: jest.fn(), storage: { from: jest.fn() } } }));
const mockAuth = { state: { status: 'guest', user: null as { id: string } | null } };
jest.mock('@/store/useAuthStore', () => ({ useAuthStore: { getState: () => mockAuth.state }, registerAccountHooks: jest.fn() }));
jest.mock('@/services/sync/syncTrigger', () => ({
  requestAccountSync: jest.fn(),
  currentEditOrigin: () => (mockAuth.state.user ? 'account' : 'guest'),
  currentAccountId: () => mockAuth.state.user?.id ?? null,
  registerSyncScheduler: jest.fn(),
}));

// Synthetic writing only.
const TEXT = 'Synthetic unsaved memory text 8h2v';
const ENTRY_ID = '0b3f0c5e-1d8a-4f2e-9c1b-2a7d5e6f8a90';

let picks = 0;
/** A fresh "picked + normalized" JPEG in the temp cache, like the editor makes. */
function tempPick(): string {
  const file = new File(Paths.cache, `ImageManipulator-${++picks}.jpg`);
  file.create();
  file.write(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, picks]));
  return file.uri;
}
const exists = (uri: string | null | undefined) => !!uri && new File(uri).exists;
const folderFiles = (owner: string) => {
  const folder = new Directory(Paths.document, 'journal', owner);
  return folder.exists ? folder.list().map((item) => item.name).sort() : [];
};
const signIn = (id: string | null) => {
  mockAuth.state = id ? { status: 'authenticated', user: { id } } : { status: 'guest', user: null };
  bumpAccountGeneration();
};
const fields = (overrides: Partial<EditorFields> = {}): EditorFields => ({ ...baselineForNew('2026-10-01', null), ...overrides });
async function restart() {
  useJournalDraftStore.setState({ isLoaded: false, saved: {} });
  useJournalStore.setState({ isLoaded: false, entries: [] });
  await useJournalDraftStore.getState().load();
  await useJournalStore.getState().load();
}
async function savedEntryWithPhoto(): Promise<JournalEntry> {
  return (await useJournalStore.getState().create({ title: 'Lake', note: 'saved', date: '2026-09-20', photoUri: tempPick(), link: null }, { id: ENTRY_ID }))!;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  for (const owner of ['guest', 'user-a', 'user-b']) journalPhotos.deleteAllLocalPhotos(owner);
  signIn(null);
  useJournalStore.setState({ entries: [], isLoaded: true });
  useJournalDraftStore.setState({ saved: {}, isLoaded: true });
  jest.restoreAllMocks();
});

it('photos are supported in this test environment', () => {
  expect(journalPhotos.journalPhotosSupported()).toBe(true);
});

describe('1. new draft + photo, restart, restore', () => {
  it('the draft owns a copy of its photo; it survives the temp file being purged; restore + save makes one entry and cleans up', async () => {
    const pick = tempPick();
    await useJournalDraftStore.getState().put('guest', makeDraft('new', ENTRY_ID, fields({ note: TEXT, photoUri: pick }), null));
    const stored = useJournalDraftStore.getState().get('guest', 'new')!;
    expect(journalPhotos.isDraftPhoto(stored.fields.photoUri, 'guest')).toBe(true);
    expect(stored.photoSource).toBe(pick);

    new File(pick).delete(); // the OS clears temp files
    await restart();
    const draft = useJournalDraftStore.getState().get('guest', 'new')!;
    const restored = restoredFields(draft, fields(), journalPhotos.localPhotoExists);
    expect(restored).toMatchObject({ photoLost: false, fields: { note: TEXT } });

    const saved = (await useJournalStore.getState().create(restored.fields, { id: draft.entryId }))!;
    await useJournalDraftStore.getState().remove('guest', 'new');
    expect(exists(saved.photo?.localUri)).toBe(true);
    expect(exists(draft.fields.photoUri)).toBe(false); // the draft copy is gone
    expect(folderFiles('guest')).toEqual([saved.photo!.localUri!.split('/').pop()]);
  });

  it('writing the same pick again reuses the copy (no copy per keystroke)', async () => {
    const pick = tempPick();
    await useJournalDraftStore.getState().put('guest', makeDraft('new', ENTRY_ID, fields({ note: 'a', photoUri: pick }), null));
    await useJournalDraftStore.getState().put('guest', makeDraft('new', ENTRY_ID, fields({ note: 'ab', photoUri: pick }), null));
    expect(folderFiles('guest').filter((name) => name.startsWith('draft-'))).toHaveLength(1);
  });
});

describe('2. edit an entry, replace its photo, discard', () => {
  it('discard restores the saved fields and photo; only the replacement files go', async () => {
    const entry = await savedEntryWithPhoto();
    const replacement = tempPick();
    await useJournalDraftStore.getState().put('guest', makeDraft(ENTRY_ID, ENTRY_ID, { ...baselineForEntry(entry), note: TEXT, photoUri: replacement }, entry.updatedAt));
    const draftCopy = useJournalDraftStore.getState().get('guest', ENTRY_ID)!.fields.photoUri;
    // Discard = remove the draft; the editor resets to the saved baseline.
    await useJournalDraftStore.getState().remove('guest', ENTRY_ID);
    expect(baselineForEntry(useJournalStore.getState().entries[0])).toEqual(baselineForEntry(entry));
    expect(exists(entry.photo!.localUri)).toBe(true);
    expect(exists(draftCopy)).toBe(false);
    expect(exists(replacement)).toBe(false);
  });

  it("an edit draft that keeps the entry's own photo never deletes it", async () => {
    const entry = await savedEntryWithPhoto();
    await useJournalDraftStore.getState().put('guest', makeDraft(ENTRY_ID, ENTRY_ID, { ...baselineForEntry(entry), note: TEXT }, entry.updatedAt));
    expect(useJournalDraftStore.getState().get('guest', ENTRY_ID)!.fields.photoUri).toBe(entry.photo!.localUri);
    await useJournalDraftStore.getState().remove('guest', ENTRY_ID);
    expect(exists(entry.photo!.localUri)).toBe(true);
  });
});

describe('3. a failed save, leave, recover', () => {
  it('nothing is saved, the draft (text + photo) is there after a restart, and the error says why', async () => {
    const pick = tempPick();
    const draft = makeDraft('new', ENTRY_ID, fields({ note: TEXT, photoUri: pick }), null);
    await useJournalDraftStore.getState().put('guest', draft);
    (AsyncStorage.setItem as jest.Mock).mockImplementationOnce(() => Promise.reject(new Error('disk full')));
    await expect(useJournalStore.getState().create(draft.fields, { id: ENTRY_ID })).rejects.toEqual(new JournalSaveError('storage'));
    // The failed save's photo copy is cleaned up; the draft's own copy is not.
    expect(folderFiles('guest').filter((name) => !name.startsWith('draft-'))).toEqual([]);
    await restart();
    const recovered = useJournalDraftStore.getState().get('guest', 'new')!;
    expect(recovered.fields.note).toBe(TEXT);
    expect(exists(recovered.fields.photoUri)).toBe(true);
    expect(useJournalStore.getState().entries).toEqual([]);
  });
});

describe('4. account switch while a draft write / photo copy is pending', () => {
  it('a write still loading when the account is cleared stores nothing', async () => {
    signIn('user-a');
    useJournalDraftStore.setState({ isLoaded: false, saved: {} });
    const writing = useJournalDraftStore.getState().put('user-a', makeDraft('new', ENTRY_ID, fields({ note: TEXT }), null));
    await clearAccountBoundState({ filesOwner: 'user-a' }); // A signs out (synced)
    signIn('user-b');
    expect(await writing).toBe(false);
    await journalDraftCleanupSettled();
    expect(useJournalDraftStore.getState().get('user-a', 'new')).toBeNull();
    expect((await AsyncStorage.getItem(JOURNAL_DRAFTS_KEY)) ?? '').not.toContain(TEXT);
  });

  it('a photo copy finishing after the account was cleared leaves no file and no draft', async () => {
    signIn('user-a');
    const realKeep = journalPhotos.keepDraftPhoto;
    jest.spyOn(journalPhotos, 'keepDraftPhoto').mockImplementation(async (...args) => {
      const copy = await realKeep(...args);
      await clearAccountBoundState({ filesOwner: 'user-a' }); // cleared mid-copy
      return copy;
    });
    expect(await useJournalDraftStore.getState().put('user-a', makeDraft('new', ENTRY_ID, fields({ note: TEXT, photoUri: tempPick() }), null))).toBe(false);
    await journalDraftCleanupSettled();
    expect(folderFiles('user-a')).toEqual([]);
    expect(useJournalDraftStore.getState().get('user-a', 'new')).toBeNull();
  });

  it("drafts stay with their owner: B never reads A's; a guest's draft and photo move into the account", async () => {
    await useJournalDraftStore.getState().put('guest', makeDraft('new', ENTRY_ID, fields({ note: TEXT, photoUri: tempPick() }), null));
    await useJournalDraftStore.getState().adoptGuest('user-a');
    const adopted = useJournalDraftStore.getState().get('user-a', 'new')!;
    expect(journalPhotos.isDraftPhoto(adopted.fields.photoUri, 'user-a')).toBe(true);
    expect(exists(adopted.fields.photoUri)).toBe(true);
    expect(folderFiles('guest')).toEqual([]);
    expect(useJournalDraftStore.getState().get('user-b', 'new')).toBeNull();
    // A signs out with everything synced: A's draft and its photo go.
    await clearAccountBoundState({ filesOwner: 'user-a' });
    await journalDraftCleanupSettled();
    expect(useJournalDraftStore.getState().get('user-a', 'new')).toBeNull();
    expect(folderFiles('user-a')).toEqual([]);
  });
});

describe('5. deleting an entry that has a recoverable draft', () => {
  it('deleting it here removes its draft and the draft photo; the entry photo goes with the entry', async () => {
    const entry = await savedEntryWithPhoto();
    await useJournalDraftStore.getState().put('guest', makeDraft(ENTRY_ID, ENTRY_ID, { ...baselineForEntry(entry), note: TEXT, photoUri: tempPick() }, entry.updatedAt));
    await useJournalStore.getState().remove(ENTRY_ID);
    await new Promise((resolve) => setImmediate(resolve));
    expect(useJournalDraftStore.getState().get('guest', ENTRY_ID)).toBeNull();
    expect(folderFiles('guest')).toEqual([]);
  });

  it('deleted on another device (sync tombstone): the draft goes too; an entry not synced yet keeps its draft', async () => {
    signIn('user-a');
    const entry = await savedEntryWithPhoto();
    await useJournalDraftStore.getState().put('user-a', makeDraft(ENTRY_ID, ENTRY_ID, { ...baselineForEntry(entry), note: TEXT }, entry.updatedAt));
    await useJournalDraftStore.getState().put('user-a', makeDraft('11111111-2222-4333-8444-555555555555', '11111111-2222-4333-8444-555555555555', fields({ note: 'not synced yet' }), null));
    await useJournalStore.getState().replaceAll([{ ...entry, title: '', note: '', photo: null, deletedAt: '2026-10-06T00:00:00.000Z' }]);
    await new Promise((resolve) => setImmediate(resolve));
    expect(useJournalDraftStore.getState().get('user-a', ENTRY_ID)).toBeNull();
    expect(useJournalDraftStore.getState().get('user-a', '11111111-2222-4333-8444-555555555555')).not.toBeNull();
  });
});

describe('6. restoring a draft whose photo is missing', () => {
  it('the text comes back; the photo is reported lost and falls back to the saved one', async () => {
    const entry = await savedEntryWithPhoto();
    // A draft from before photo copies existed (or a failed copy): it points at a temp file that is gone.
    const goneTemp = `${Paths.cache.uri}/ImageManipulator-gone.jpg`;
    await AsyncStorage.setItem(JOURNAL_DRAFTS_KEY, JSON.stringify({ guest: { [ENTRY_ID]: makeDraft(ENTRY_ID, ENTRY_ID, { ...baselineForEntry(entry), note: TEXT, photoUri: goneTemp }, entry.updatedAt) } }));
    useJournalDraftStore.setState({ isLoaded: false, saved: {} });
    await useJournalDraftStore.getState().load();
    const offer = restoreOffer(useJournalDraftStore.getState().get('guest', ENTRY_ID), baselineForEntry(entry), entry)!;
    const restored = restoredFields(offer.draft, baselineForEntry(entry), journalPhotos.localPhotoExists);
    expect(restored).toMatchObject({ photoLost: true, fields: { note: TEXT, photoUri: entry.photo!.localUri } });
  });
});
