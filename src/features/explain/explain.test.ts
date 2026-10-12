import AsyncStorage from '@react-native-async-storage/async-storage';

import { draftMap } from '@/services/drafts/draftRegistry';
import { EXPLANATIONS_KEY, ownerExplanations, useExplanationsStore } from '@/store/useExplanationsStore';

import { clearExplainDraftIfUnchanged, explainDraft, normalizeExplanations, PROMPTS, saveExplanation, setExplainDraft } from './explainModel';

const store = () => useExplanationsStore.getState();
const mine = (owner: string) => ownerExplanations(store().saved, owner);
const input = (text: string, change = {}) => ({ articleId: 'boz-uy-overview', titleSnapshot: 'Боз үй', promptId: 'friend' as const, text, ...change });

beforeEach(async () => {
  draftMap('explanation').clear();
  await AsyncStorage.clear();
  useExplanationsStore.setState({ status: 'idle', saved: {} });
  await store().load();
});

describe('draft lifecycle', () => {
  it('a draft is kept (per owner) until what was sent is saved; newer typing survives', () => {
    const sent = { text: 'First words', promptId: 'friend' as const, titleSnapshot: 'Боз үй' };
    setExplainDraft('user-a', 'a1', sent);
    expect(explainDraft('user-b', 'a1')).toBeNull();
    const newer = { ...sent, text: 'First words, and more' };
    setExplainDraft('user-a', 'a1', newer); // typed while saving
    clearExplainDraftIfUnchanged('user-a', 'a1', sent);
    expect(explainDraft('user-a', 'a1')).toBe(newer);
    clearExplainDraftIfUnchanged('user-a', 'a1', newer);
    expect(explainDraft('user-a', 'a1')).toBeNull();
  });
  it('the prompts are a fixed reviewed set', () => {
    expect(PROMPTS).toEqual(['friend', 'mainIdea', 'noticed']);
  });
});

describe('revisions', () => {
  it('first save, then revisions count up; an unchanged save is a no-op', () => {
    const first = saveExplanation(undefined, input('A'), 'T1');
    expect(first).toMatchObject({ text: 'A', revisions: 0, createdAt: 'T1' });
    const second = saveExplanation(first, input('B'), 'T2');
    expect(second).toMatchObject({ text: 'B', revisions: 1, createdAt: 'T1', updatedAt: 'T2' });
    expect(saveExplanation(second, input('B'), 'T3')).toBe(second);
  });
  it('the saved text stays until a revision is written; a failed revision keeps the old text', async () => {
    expect(await store().save('guest', input('Saved version'))).toBe(true);
    const real = AsyncStorage.setItem;
    AsyncStorage.setItem = () => Promise.reject(new Error('disk'));
    try {
      expect(await store().save('guest', input('Revision that fails'))).toBe(false);
    } finally {
      AsyncStorage.setItem = real;
    }
    expect(mine('guest')['boz-uy-overview'].text).toBe('Saved version');
    expect(await store().save('guest', input('Revision'))).toBe(true);
    expect(mine('guest')['boz-uy-overview']).toMatchObject({ text: 'Revision', revisions: 1 });
  });
  it('empty text is never saved', async () => {
    expect(await store().save('guest', input('   '))).toBe(false);
    expect(mine('guest')).toEqual({});
  });
});

describe('ownership and missing articles', () => {
  it("one owner's revision never touches another owner's entry for the same article", async () => {
    await store().save('user-a', input('A text'));
    await store().save('user-b', input('B text'));
    await store().save('user-b', input('B revised'));
    expect(mine('user-a')['boz-uy-overview'].text).toBe('A text');
    expect(mine('user-b')['boz-uy-overview'].text).toBe('B revised');
  });
  it('the title snapshot and the writing survive a removed article', () => {
    const kept = normalizeExplanations({ gone: { articleId: 'gone', titleSnapshot: 'Old title', promptId: 'noticed', text: 'Mine', createdAt: 'T', updatedAt: 'T', revisions: 2 }, bad: { articleId: 'x', text: 'y' } });
    expect(Object.keys(kept)).toEqual(['gone']);
    expect(kept.gone).toMatchObject({ titleSnapshot: 'Old title', text: 'Mine', promptId: 'noticed' });
  });
});

describe('delayed writes', () => {
  it('two saves in flight land in order (the later revision wins, nothing lost)', async () => {
    const real = AsyncStorage.setItem;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let first = true;
    AsyncStorage.setItem = async (key, value) => {
      if (first) {
        first = false;
        await gate;
      }
      return real(key, value);
    };
    try {
      const a = store().save('guest', input('One'));
      const b = store().save('guest', input('Two'));
      release();
      expect(await Promise.all([a, b])).toEqual([true, true]);
    } finally {
      AsyncStorage.setItem = real;
    }
    expect(JSON.parse((await AsyncStorage.getItem(EXPLANATIONS_KEY))!).guest['boz-uy-overview']).toMatchObject({ text: 'Two', revisions: 1 });
  });
});
