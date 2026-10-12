import AsyncStorage from '@react-native-async-storage/async-storage';

import { EMPTY_OYMO_STATE, addLayer } from '@/services/culture/oymoEditor';
import { FIRST_USE_KEY, recordFor, useFirstUseStore } from '@/store/useFirstUseStore';

import { currentStep, draftFor, FIRST_ARTICLE_ID, hasAwaitingDraft, homeCard, keepDraft, markDone, NEW_RECORD, normalizeRecord, peekDraft, pickArticle, saveGuideDesign } from './firstUseModel';

const design = addLayer(EMPTY_OYMO_STATE, { x: 10, y: 10 }, 'muyuz', '#000000');
const reset = async () => {
  await AsyncStorage.clear();
  keepDraft(null);
  useFirstUseStore.setState({ status: 'idle', saved: {} });
  await useFirstUseStore.getState().load();
};
const store = () => useFirstUseStore.getState();
const record = (owner: string) => recordFor(store().saved, owner);

beforeEach(reset);

describe('steps', () => {
  it('runs article -> create -> save -> find in order, then finishes (no score)', () => {
    let next = { ...NEW_RECORD };
    expect(currentStep(next)).toBe('article');
    expect(markDone(next, 'create', 't')).toBe(next); // out of order: ignored
    for (const step of ['article', 'create', 'save', 'find'] as const) next = markDone(next, step, 't', step === 'save' ? { saveChoice: 'not_saved' } : {});
    expect(next.status).toBe('finished');
    expect(Object.keys(next).sort()).toEqual(['done', 'saveChoice', 'savedName', 'status']);
  });
  it('picks the suggested article, or the first available one', () => {
    expect(pickArticle(['a', FIRST_ARTICLE_ID])).toBe(FIRST_ARTICLE_ID);
    expect(pickArticle(['a', 'b'])).toBe('a');
    expect(pickArticle([])).toBeNull();
  });
  it('drops malformed stored records', () => {
    expect(normalizeRecord({ status: 'mastered' })).toBeNull();
    expect(normalizeRecord({ status: 'active', done: { article: 5, create: 't' } })).toEqual({ status: 'active', done: { create: 't' }, saveChoice: null, savedName: null });
  });
});

describe('offer, skip, resume', () => {
  it('only offered after onboarding marked it; never re-offered over an existing record', async () => {
    expect(homeCard(record('guest'))).toBeNull(); // existing users: nothing unprompted
    await store().offer('guest');
    expect(homeCard(record('guest'))).toBe('offer');
    await store().skip('guest');
    expect(homeCard(record('guest'))).toBeNull();
    await store().offer('guest');
    expect(record('guest')!.status).toBe('skipped');
  });
  it('resumes where it stopped after a restart', async () => {
    await store().start('guest');
    await store().done('guest', 'article');
    useFirstUseStore.setState({ status: 'idle', saved: {} });
    await store().load();
    expect(homeCard(record('guest'))).toBe('continue');
    expect(currentStep(record('guest')!)).toBe('create');
  });
  it('replay starts a fresh run', async () => {
    await store().start('guest');
    for (const step of ['article', 'create', 'save', 'find'] as const) await store().done('guest', step, step === 'save' ? { saveChoice: 'not_saved' } : {});
    expect(record('guest')!.status).toBe('finished');
    await store().start('guest');
    expect(record('guest')).toEqual(NEW_RECORD);
  });
  it('a failed write is reported and not shown; an unreadable store blocks writes', async () => {
    const real = AsyncStorage.setItem;
    AsyncStorage.setItem = () => Promise.reject(new Error('disk full'));
    try {
      expect(await store().start('guest')).toBe(false);
      expect(record('guest')).toBeNull();
    } finally {
      AsyncStorage.setItem = real;
    }
    await AsyncStorage.setItem(FIRST_USE_KEY, '{broken');
    useFirstUseStore.setState({ status: 'idle', saved: {} });
    await store().load();
    expect(store().status).toBe('error');
    expect(await store().start('guest')).toBe(false);
  });
});

describe('owners', () => {
  it('keeps progress per owner', async () => {
    await store().start('user-a');
    await store().done('user-a', 'article');
    expect(record('user-b')).toBeNull();
    expect(currentStep(record('user-a')!)).toBe('create');
  });
  it("another account never gets an unsaved design that isn't waiting for sign-in", () => {
    keepDraft({ owner: 'user-a', state: design, symmetry: 'fourWay', name: 'A', awaitingAuth: false });
    expect(draftFor('user-a').draft?.name).toBe('A');
    expect(draftFor('user-b').draft).toBeNull();
    expect(peekDraft()).toBeNull(); // dropped, not kept for later
  });
  it("a signed-in account's draft is never handed to a guest", () => {
    keepDraft({ owner: 'user-a', state: design, symmetry: 'fourWay', name: 'A', awaitingAuth: true });
    expect(draftFor('guest').draft).toBeNull();
  });
});

describe('auth handoff', () => {
  it("the guest's design and progress continue in the account that signs in", async () => {
    await store().start('guest');
    await store().done('guest', 'article');
    await store().done('guest', 'create');
    keepDraft({ owner: 'guest', state: design, symmetry: 'fourWay', name: 'Mine', awaitingAuth: true });
    expect(hasAwaitingDraft()).toBe(true);
    const { draft, adoptedFrom } = draftFor('user-a');
    expect(adoptedFrom).toBe('guest');
    expect(draft).toMatchObject({ owner: 'user-a', name: 'Mine', awaitingAuth: false });
    expect(draft!.state.layers).toHaveLength(1);
    await store().adopt('guest', 'user-a');
    expect(currentStep(record('user-a')!)).toBe('save');
    expect(hasAwaitingDraft()).toBe(false);
  });
  it("never overwrites the account's own active run", async () => {
    await store().start('guest');
    await store().start('user-a');
    await store().done('user-a', 'article');
    await store().done('guest', 'article');
    await store().done('guest', 'create');
    await store().adopt('guest', 'user-a');
    expect(currentStep(record('user-a')!)).toBe('create');
  });
});

describe('save', () => {
  it('records "saved" only after the save succeeded', async () => {
    keepDraft({ owner: 'user-a', state: design, symmetry: 'fourWay', name: 'X', awaitingAuth: false });
    const markSaved = jest.fn(async () => true);
    expect(await saveGuideDesign({ save: async () => true, markSaved })).toBe('saved');
    expect(markSaved).toHaveBeenCalledTimes(1);
    expect(peekDraft()).toBeNull();
  });
  it('a failed save keeps the design and marks nothing', async () => {
    keepDraft({ owner: 'user-a', state: design, symmetry: 'fourWay', name: 'X', awaitingAuth: false });
    const markSaved = jest.fn(async () => true);
    expect(await saveGuideDesign({ save: async () => false, markSaved })).toBe('failed');
    expect(markSaved).not.toHaveBeenCalled();
    expect(peekDraft()?.state.layers).toHaveLength(1);
  });
  it('a saved design whose step could not be recorded is still reported as saved, separately', async () => {
    expect(await saveGuideDesign({ save: async () => true, markSaved: async () => false })).toBe('saved_unrecorded');
  });
});
