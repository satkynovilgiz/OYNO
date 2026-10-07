import AsyncStorage from '@react-native-async-storage/async-storage';

import { deleteTempImage } from '@/services/media/normalizeImage';
import { bumpAccountGeneration } from '@/services/sync/accountGeneration';
import { clearAccountBoundState } from '@/services/sync/accountScope';
import { JOURNAL_DRAFTS_KEY, journalDraftCleanupSettled, releaseEditorPhoto, useJournalDraftStore } from '@/store/useJournalDraftStore';
import { JOURNAL_STORAGE_KEY, JournalSaveError, useJournalStore } from '@/store/useJournalStore';

import type { JournalEntry } from '../journalModel';
import { baselineForEntry, baselineForNew, changedFields, isDirty, makeDraft, parseStoredDraft, restoredFields, restoreOffer, type EditorFields } from './editorDraft';
import { selectDraftOwner } from './useEditorSession';

jest.mock('@/services/supabase/client', () => ({ supabase: { rpc: jest.fn(), from: jest.fn(), storage: { from: jest.fn() } } }));
jest.mock('@/services/media/normalizeImage', () => ({ ...jest.requireActual('@/services/media/normalizeImage'), deleteTempImage: jest.fn() }));

const mockAuth = { state: { status: 'guest', user: null as { id: string } | null } };
jest.mock('@/store/useAuthStore', () => ({ useAuthStore: { getState: () => mockAuth.state }, registerAccountHooks: jest.fn() }));
jest.mock('@/services/sync/syncTrigger', () => ({
  requestAccountSync: jest.fn(),
  currentEditOrigin: () => (mockAuth.state.user ? 'account' : 'guest'),
  currentAccountId: () => mockAuth.state.user?.id ?? null,
  registerSyncScheduler: jest.fn(),
}));

// Synthetic private text - never real user data.
const SECRET_A = 'Account A private draft 9q2x';
const SECRET_B = 'Account B private draft 4m7z';
const TEMP = 'file:///cache/ImageManipulator/draft-photo.jpg';

const ENTRY: JournalEntry = {
  id: '0b3f0c5e-1d8a-4f2e-9c1b-2a7d5e6f8a90',
  title: 'Song-Köl',
  note: 'Saved note',
  date: '2026-09-20',
  photo: null,
  link: null,
  createdAt: '2026-09-20T08:00:00.000Z',
  updatedAt: '2026-09-20T08:00:00.000Z',
  deletedAt: null,
};

const fields = (overrides: Partial<EditorFields> = {}): EditorFields => ({ ...baselineForNew('2026-10-01', null), ...overrides });
const signIn = (id: string | null) => {
  mockAuth.state = id ? { status: 'authenticated', user: { id } } : { status: 'guest', user: null };
  bumpAccountGeneration();
};
// The storage mock's methods are jest.fn()s: queue one failure, never replace the implementation.
const failNextWrite = () => (AsyncStorage.setItem as jest.Mock).mockImplementationOnce(() => Promise.reject(new Error('disk full')));

/** A fresh app process: in-memory stores are empty again; storage is not. */
async function restart() {
  useJournalDraftStore.setState({ isLoaded: false, saved: {} });
  useJournalStore.setState({ isLoaded: false, entries: [] });
  await useJournalDraftStore.getState().load();
  await useJournalStore.getState().load();
}

beforeEach(async () => {
  await AsyncStorage.clear();
  (deleteTempImage as jest.Mock).mockClear();
  signIn(null);
  useJournalStore.setState({ entries: [], isLoaded: true });
  useJournalDraftStore.setState({ saved: {}, isLoaded: true });
});

describe('dirty tracking', () => {
  it('opening a saved entry is not a change', () => {
    expect(isDirty(baselineForEntry(ENTRY), baselineForEntry(ENTRY))).toBe(false);
  });

  it('a blank or pre-filled new memory is not a change until something differs', () => {
    const link = { type: 'nature_site' as const, id: 'son-kol', label: 'Son-Köl' };
    expect(isDirty(baselineForNew('2026-10-01', link), baselineForNew('2026-10-01', link))).toBe(false);
    // Same link, label captured in another language: still the same content.
    expect(isDirty(baselineForNew('2026-10-01', { ...link, label: 'Соң-Көл' }), baselineForNew('2026-10-01', link))).toBe(false);
  });

  it('spaces around the title alone are not a change (it is saved trimmed); the note is exact', () => {
    const base = baselineForEntry(ENTRY);
    expect(isDirty({ ...base, title: '  Song-Köl ' }, base)).toBe(false);
    expect(changedFields({ ...base, note: 'Saved note ' }, base)).toEqual(['note']);
  });

  it('reports each kind of change', () => {
    const base = baselineForEntry(ENTRY);
    expect(changedFields({ ...base, title: 'Other' }, base)).toEqual(['title']);
    expect(changedFields({ ...base, date: '2026-09-21' }, base)).toEqual(['date']);
    expect(changedFields({ ...base, photoUri: TEMP }, base)).toEqual(['photoUri']);
    expect(changedFields({ ...base, link: { type: 'trail', id: 'issyk-kul-south-shore', label: 'x' } }, base)).toEqual(['link']);
  });
});

describe('stored drafts are re-validated', () => {
  const good = () => JSON.parse(JSON.stringify(makeDraft('new', ENTRY.id, fields({ note: SECRET_A }), null)));

  it('keeps a well-formed draft', () => {
    expect(parseStoredDraft(good(), 'new')?.fields.note).toBe(SECRET_A);
  });

  it.each([
    ['not an object', 'x'],
    ['wrong version', { ...good(), v: 2 }],
    ['stored under another target', { ...good(), target: 'other' }],
    ['edit draft whose entry id differs from its target', { ...good(), target: 'abc', entryId: 'def' }],
    ['entry id that is a path', { ...good(), entryId: '../etc' }],
    ['note is not text', { ...good(), fields: { ...good().fields, note: 42 } }],
    ['bad date', { ...good(), fields: { ...good().fields, date: 'tomorrow' } }],
    ['bad savedAt', { ...good(), savedAt: 'never' }],
  ])('drops a draft with %s', (_label, value) => {
    expect(parseStoredDraft(value, 'new')).toBeNull();
  });

  it('never trusts a remote / traversal photo or a link to unknown content; clips long text', () => {
    const raw = good();
    raw.fields.photoUri = 'https://evil.example/x.jpg';
    raw.fields.link = { type: 'nature_site', id: 'no-such-place', label: 'x' };
    raw.fields.note = 'n'.repeat(10_000);
    const parsed = parseStoredDraft(raw, 'new')!;
    expect(parsed.fields.photoUri).toBeNull();
    expect(parsed.fields.link).toBeNull();
    expect(parsed.fields.note).toHaveLength(4000);
    raw.fields.photoUri = 'file:///cache/../journal/user-b/x.jpg';
    expect(parseStoredDraft(raw, 'new')!.fields.photoUri).toBeNull();
  });
});

describe('restore offer', () => {
  it('offers only a draft that differs from what is saved', () => {
    const base = baselineForEntry(ENTRY);
    expect(restoreOffer(makeDraft(ENTRY.id, ENTRY.id, base, ENTRY.updatedAt), base, ENTRY)).toBeNull();
    expect(restoreOffer(makeDraft(ENTRY.id, ENTRY.id, { ...base, note: SECRET_A }, ENTRY.updatedAt), base, ENTRY)).toMatchObject({ entryChangedSince: false });
  });

  it('says when the saved memory changed after the draft began', () => {
    const base = baselineForEntry(ENTRY);
    const offer = restoreOffer(makeDraft(ENTRY.id, ENTRY.id, { ...base, note: SECRET_A }, '2026-09-01T00:00:00.000Z'), base, ENTRY);
    expect(offer?.entryChangedSince).toBe(true);
  });

  it('offers nothing for an edit whose entry is not here', () => {
    expect(restoreOffer(makeDraft(ENTRY.id, ENTRY.id, fields({ note: SECRET_A }), null), fields(), null)).toBeNull();
  });

  it('a draft photo the OS has since cleared comes back as the saved photo, and says so', () => {
    const base = baselineForEntry(ENTRY);
    const draft = makeDraft(ENTRY.id, ENTRY.id, { ...base, note: SECRET_A, photoUri: TEMP }, ENTRY.updatedAt);
    expect(restoredFields(draft, base, () => false)).toEqual({ fields: { ...base, note: SECRET_A, photoUri: null }, photoLost: true });
    expect(restoredFields(draft, base, () => true).photoLost).toBe(false);
  });
});

describe('drafts per owner', () => {
  it('survives an app restart', async () => {
    await useJournalDraftStore.getState().put('guest', makeDraft('new', ENTRY.id, fields({ note: SECRET_A }), null));
    await restart();
    expect(useJournalDraftStore.getState().get('guest', 'new')?.fields.note).toBe(SECRET_A);
  });

  it('is read only for its own owner', async () => {
    signIn('user-a');
    await useJournalDraftStore.getState().put('user-a', makeDraft('new', ENTRY.id, fields({ note: SECRET_A }), null));
    signIn('user-b');
    const store = useJournalDraftStore.getState();
    expect(store.get(selectDraftOwner(mockAuth.state), 'new')).toBeNull();
    expect(store.get('guest', 'new')).toBeNull();
    expect(store.get('../user-a', 'new')).toBeNull();
    expect(store.get('user-a', 'new')?.fields.note).toBe(SECRET_A);
  });

  it("an account's drafts are dropped exactly when its journal files are - kept while its unsynced state is set aside", async () => {
    await useJournalDraftStore.getState().put('user-a', makeDraft('new', ENTRY.id, fields({ note: SECRET_A, photoUri: TEMP }), null));
    await useJournalDraftStore.getState().put('user-b', makeDraft('new', ENTRY.id, fields({ note: SECRET_B }), null));

    // Sign-out that could not sync: A's work is stashed for A -> drafts stay.
    await clearAccountBoundState({ filesOwner: null });
    await journalDraftCleanupSettled();
    expect(useJournalDraftStore.getState().get('user-a', 'new')).not.toBeNull();

    // Sign-out with everything synced / account deleted: A's drafts go, B's stay.
    await clearAccountBoundState({ filesOwner: 'user-a' });
    await journalDraftCleanupSettled();
    await restart();
    expect(useJournalDraftStore.getState().get('user-a', 'new')).toBeNull();
    expect(useJournalDraftStore.getState().get('user-b', 'new')?.fields.note).toBe(SECRET_B);
    expect(await AsyncStorage.getItem(JOURNAL_DRAFTS_KEY)).not.toContain(SECRET_A);
    expect(deleteTempImage).toHaveBeenCalledWith(TEMP);
  });

  it("a guest's drafts follow them into their account; an account draft for the same target wins", async () => {
    await useJournalDraftStore.getState().put('guest', makeDraft('new', ENTRY.id, fields({ note: 'guest new' }), null));
    await useJournalDraftStore.getState().put('guest', makeDraft(ENTRY.id, ENTRY.id, fields({ note: 'guest edit' }), ENTRY.updatedAt));
    await useJournalDraftStore.getState().put('user-a', makeDraft(ENTRY.id, ENTRY.id, fields({ note: SECRET_A }), ENTRY.updatedAt));
    await useJournalDraftStore.getState().adoptGuest('user-a');
    const store = useJournalDraftStore.getState();
    expect(store.get('guest', 'new')).toBeNull();
    expect(store.get('user-a', 'new')?.fields.note).toBe('guest new');
    expect(store.get('user-a', ENTRY.id)?.fields.note).toBe(SECRET_A);
  });

  it('ignores corrupt storage instead of crashing', async () => {
    await AsyncStorage.setItem(JOURNAL_DRAFTS_KEY, JSON.stringify({ guest: { new: { v: 1, junk: true } }, '../x': {}, 'user-a': 'nope' }));
    await restart();
    expect(useJournalDraftStore.getState().saved).toEqual({});
    await AsyncStorage.setItem(JOURNAL_DRAFTS_KEY, '{not json');
    await restart();
    expect(useJournalDraftStore.getState().saved).toEqual({});
  });
});

describe('temporary photos', () => {
  it('is not deleted while a draft or a saved entry references it', async () => {
    await useJournalDraftStore.getState().put('guest', makeDraft('new', ENTRY.id, fields({ photoUri: TEMP }), null));
    releaseEditorPhoto(TEMP);
    expect(deleteTempImage).not.toHaveBeenCalled();

    await useJournalDraftStore.getState().remove('guest', 'new');
    expect(deleteTempImage).toHaveBeenCalledWith(TEMP);

    (deleteTempImage as jest.Mock).mockClear();
    useJournalStore.setState({ entries: [{ ...ENTRY, photo: { localUri: TEMP, remotePath: null, versionId: null } }] });
    releaseEditorPhoto(TEMP);
    expect(deleteTempImage).not.toHaveBeenCalled();
  });

  it("replacing a draft's photo releases the old one only if nothing else uses it", async () => {
    const other = 'file:///cache/ImageManipulator/other.jpg';
    await useJournalDraftStore.getState().put('guest', makeDraft('new', ENTRY.id, fields({ photoUri: TEMP }), null));
    await useJournalDraftStore.getState().put('user-a', makeDraft('new', ENTRY.id, fields({ photoUri: TEMP }), null));
    await useJournalDraftStore.getState().put('guest', makeDraft('new', ENTRY.id, fields({ photoUri: other }), null));
    expect(deleteTempImage).not.toHaveBeenCalled(); // user-a's draft still points at it
    await useJournalDraftStore.getState().put('user-a', makeDraft('new', ENTRY.id, fields({ photoUri: other }), null));
    expect(deleteTempImage).toHaveBeenCalledWith(TEMP);
  });
});

describe('saving a draft', () => {
  const draft = (note: string) => ({ title: 'Lake', note, date: '2026-09-20', photoUri: null, link: null });

  it('saving the same new draft twice (retry / restored after a crash) makes ONE entry', async () => {
    const first = await useJournalStore.getState().create(draft(SECRET_A), { id: ENTRY.id });
    await restart();
    const second = await useJournalStore.getState().create(draft(`${SECRET_A} more`), { id: ENTRY.id });
    const visible = useJournalStore.getState().entries.filter((entry) => !entry.deletedAt);
    expect(visible).toHaveLength(1);
    expect(first?.id).toBe(ENTRY.id);
    expect(second?.id).toBe(ENTRY.id);
    expect(visible[0].note).toBe(`${SECRET_A} more`);
  });

  it('a draft id whose entry was deleted becomes a new memory, never a resurrection', async () => {
    signIn('user-a');
    await useJournalStore.getState().create(draft('first'), { id: ENTRY.id });
    await useJournalStore.getState().remove(ENTRY.id);
    const again = await useJournalStore.getState().create(draft('again'), { id: ENTRY.id });
    expect(again?.id).not.toBe(ENTRY.id);
    expect(useJournalStore.getState().entries.find((entry) => entry.id === ENTRY.id)?.deletedAt).toBeTruthy();
  });

  it('a storage failure changes nothing, says so, and the draft stays', async () => {
    await useJournalDraftStore.getState().put('guest', makeDraft('new', ENTRY.id, fields({ note: SECRET_A }), null));
    failNextWrite();
    await expect(useJournalStore.getState().create(draft(SECRET_A), { id: ENTRY.id })).rejects.toEqual(new JournalSaveError('storage'));
    expect(useJournalStore.getState().entries).toEqual([]);
    await restart();
    expect(useJournalStore.getState().entries).toEqual([]);
    expect(useJournalDraftStore.getState().get('guest', 'new')?.fields.note).toBe(SECRET_A);
  });

  it('a failed edit keeps the saved version exactly as it was', async () => {
    const saved = (await useJournalStore.getState().create(draft('original'), { id: ENTRY.id }))!;
    failNextWrite();
    await expect(useJournalStore.getState().update(ENTRY.id, draft(SECRET_A))).rejects.toBeInstanceOf(JournalSaveError);
    expect(useJournalStore.getState().entries).toEqual([saved]);
  });

  it('a photo that cannot be kept fails the save instead of silently dropping the photo', async () => {
    await expect(useJournalStore.getState().create({ ...draft(SECRET_A), photoUri: TEMP }, { id: ENTRY.id })).rejects.toEqual(new JournalSaveError('photo'));
    expect(useJournalStore.getState().entries).toEqual([]);
    expect(deleteTempImage).not.toHaveBeenCalled();
  });

  it('an account switch during the save writes nothing into the next account', async () => {
    signIn('user-a');
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const setItem = AsyncStorage.setItem as jest.Mock;
    const real = setItem.getMockImplementation()!;
    setItem.mockImplementationOnce(async (key: string, value: string) => {
      await gate;
      return real(key, value);
    });
    const saving = useJournalStore.getState().create(draft(SECRET_A), { id: ENTRY.id });
    // Account A signs out, B signs in: the lifecycle clears and resets the journal.
    signIn('user-b');
    await AsyncStorage.removeItem(JOURNAL_STORAGE_KEY);
    useJournalStore.getState().reset();
    release();
    await expect(saving).rejects.toEqual(new JournalSaveError('account_changed'));
    expect(useJournalStore.getState().entries).toEqual([]);
    expect((await AsyncStorage.getItem(JOURNAL_STORAGE_KEY)) ?? '').not.toContain(SECRET_A);
  });
});
