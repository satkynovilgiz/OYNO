import AsyncStorage from '@react-native-async-storage/async-storage';

import { ownerQuestions, QUESTIONS_KEY, useQuestionsStore } from '@/store/useQuestionsStore';

import { applyChange, byStatus, clearDraftIfUnchanged, getDraft, MAX_SUPPORTS, newQuestion, normalizeQuestions, resolveOrigin, setDraft, type ArticleLookup, type QuestionOrigin } from './questionsModel';

const origin: QuestionOrigin = { articleId: 'boz-uy-overview', sectionKey: 'objects_used', articleTitle: 'Boz uy', sectionLabel: 'Objects used' };
const T = '2026-10-12T10:00:00.000Z';
const store = () => useQuestionsStore.getState();
const mine = (owner: string) => ownerQuestions(store().saved, owner);

beforeEach(async () => {
  await AsyncStorage.clear();
  useQuestionsStore.setState({ status: 'idle', saved: {} });
  await store().load();
});

describe('lifecycle', () => {
  it('exploring -> answered (keeps question, sources, answer) -> reopened', () => {
    let q = newQuestion('q1', '  Why is the tunduk round?  ', origin, T);
    expect(q).toMatchObject({ text: 'Why is the tunduk round?', status: 'exploring', supports: [], answer: '' });
    q = applyChange(q, { type: 'addSupport', support: { articleId: 'boz-uy-tunduk', title: 'Tunduk' } }, T);
    q = applyChange(q, { type: 'addSupport', support: { articleId: 'boz-uy-karkas', title: 'Karkas' } }, T);
    q = applyChange(q, { type: 'answer', answer: 'My guess: the poles meet there.' }, T);
    const answered = applyChange(q, { type: 'markAnswered' }, '2026-10-12T11:00:00.000Z');
    expect(answered).toMatchObject({ status: 'answered', answeredAt: '2026-10-12T11:00:00.000Z', text: q.text, answer: q.answer, supports: q.supports, origin });
    const reopened = applyChange(answered, { type: 'reopen' }, T);
    expect(reopened).toMatchObject({ status: 'exploring', answeredAt: null, text: q.text, answer: q.answer });
  });
  it('no empty question, no duplicate or excess supports; unchanged edits are no-ops', () => {
    const q = newQuestion('q1', 'A?', origin, T);
    expect(applyChange(q, { type: 'text', text: '   ' }, T)).toBe(q);
    expect(applyChange(q, { type: 'text', text: 'A?' }, T)).toBe(q);
    let many = q;
    for (let i = 0; i < MAX_SUPPORTS + 2; i += 1) many = applyChange(many, { type: 'addSupport', support: { articleId: `a${i}`, title: `A${i}` } }, T);
    expect(many.supports).toHaveLength(MAX_SUPPORTS);
    expect(applyChange(many, { type: 'addSupport', support: { articleId: 'a0', title: 'again' } }, T)).toBe(many);
    expect(applyChange(q, { type: 'reopen' }, T)).toBe(q);
  });
  it('lists by status, newest change first', () => {
    const a = { ...newQuestion('a', 'A?', null, '2026-10-01T00:00:00Z') };
    const b = { ...newQuestion('b', 'B?', null, '2026-10-02T00:00:00Z') };
    const c = applyChange(newQuestion('c', 'C?', null, T), { type: 'markAnswered' }, T);
    expect(byStatus({ a, b, c }, 'exploring').map((q) => q.id)).toEqual(['b', 'a']);
    expect(byStatus({ a, b, c }, 'answered').map((q) => q.id)).toEqual(['c']);
  });
});

describe('source removal', () => {
  const label = (key: string) => (key === 'objects_used' ? 'Objects used (live)' : null);
  it('live section opens at its key', () => {
    const lookup: ArticleLookup = () => ({ title: 'Boz uy (live)', sections: ['history', 'objects_used'] });
    expect(resolveOrigin(origin, lookup, label)).toEqual({ state: 'live', route: '/culture/item/boz-uy-overview?section=objects_used', title: 'Boz uy (live)', sectionLabel: 'Objects used (live)' });
  });
  it('a missing section is reported with the snapshot - never another section', () => {
    const lookup: ArticleLookup = () => ({ title: 'Boz uy', sections: ['history', 'origin'] });
    const view = resolveOrigin(origin, lookup, label);
    expect(view).toEqual({ state: 'sectionMissing', articleRoute: '/culture/item/boz-uy-overview', title: 'Boz uy', sectionLabel: 'Objects used' });
    expect(JSON.stringify(view)).not.toContain('history');
  });
  it('a removed article keeps the question with its saved titles', () => {
    expect(resolveOrigin(origin, () => null, label)).toEqual({ state: 'articleMissing', title: 'Boz uy', sectionLabel: 'Objects used' });
    expect(resolveOrigin(origin, () => undefined, label).state).toBe('loading');
  });
  it('drops malformed stored records, keeps good ones', () => {
    const good = newQuestion('q1', 'A?', origin, T);
    expect(Object.keys(normalizeQuestions({ q1: good, q2: { id: 'q2', text: '' }, q3: null, q4: { id: 'other', text: 'x' } }))).toEqual(['q1']);
  });
});

describe('ownership', () => {
  it("each owner sees only their own questions", async () => {
    await store().create('user-a', 'qa', 'A?', origin);
    await store().create('user-b', 'qb', 'B?', null);
    expect(Object.keys(mine('user-a'))).toEqual(['qa']);
    expect(Object.keys(mine('user-b'))).toEqual(['qb']);
    expect(await store().change('user-b', 'qa', [{ type: 'markAnswered' }])).toBe(false); // not B's
    expect(mine('user-a').qa.status).toBe('exploring');
  });
  it('drafts are per owner', () => {
    setDraft('user-a', 's', 'secret draft');
    expect(getDraft('user-b', 's')).toBeUndefined();
    setDraft('user-a', 's', null);
  });
});

describe('writes', () => {
  it('a failed write is not shown and the store keeps the old value', async () => {
    await store().create('guest', 'q1', 'A?', origin);
    const real = AsyncStorage.setItem;
    AsyncStorage.setItem = () => Promise.reject(new Error('disk full'));
    try {
      expect(await store().change('guest', 'q1', [{ type: 'answer', answer: 'lost?' }])).toBe(false);
      expect(await store().create('guest', 'q2', 'B?', null)).toBeNull();
    } finally {
      AsyncStorage.setItem = real;
    }
    expect(mine('guest').q1.answer).toBe('');
    expect(mine('guest').q2).toBeUndefined();
  });
  it('delayed writes are serialized: the later change builds on the earlier one', async () => {
    await store().create('guest', 'q1', 'A?', origin);
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
      const a = store().change('guest', 'q1', [{ type: 'addSupport', support: { articleId: 'x', title: 'X' } }]);
      const b = store().change('guest', 'q1', [{ type: 'answer', answer: 'Both kept' }]);
      release();
      expect(await Promise.all([a, b])).toEqual([true, true]);
    } finally {
      AsyncStorage.setItem = real;
    }
    expect(mine('guest').q1).toMatchObject({ answer: 'Both kept', supports: [{ articleId: 'x', title: 'X' }] });
    expect(JSON.parse((await AsyncStorage.getItem(QUESTIONS_KEY))!).guest.q1.answer).toBe('Both kept');
  });
  it('an edit typed while saving is not cleared with the sent draft', () => {
    setDraft('guest', 'answer:q1', 'sent text');
    setDraft('guest', 'answer:q1', 'sent text, then more'); // typed during the save
    clearDraftIfUnchanged('guest', 'answer:q1', 'sent text');
    expect(getDraft('guest', 'answer:q1')).toBe('sent text, then more');
    clearDraftIfUnchanged('guest', 'answer:q1', 'sent text, then more');
    expect(getDraft('guest', 'answer:q1')).toBeUndefined();
  });
  it('an unreadable store blocks writes', async () => {
    await AsyncStorage.setItem(QUESTIONS_KEY, '{nope');
    useQuestionsStore.setState({ status: 'idle', saved: {} });
    await store().load();
    expect(store().status).toBe('error');
    expect(await store().create('guest', 'q1', 'A?', null)).toBeNull();
  });
  it('delete removes only that question', async () => {
    await store().create('guest', 'q1', 'A?', null);
    await store().create('guest', 'q2', 'B?', null);
    expect(await store().remove('guest', 'q1')).toBe(true);
    expect(Object.keys(mine('guest'))).toEqual(['q2']);
  });
});
