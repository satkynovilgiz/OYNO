jest.mock('@/services/supabase/client', () => ({ supabase: { auth: { onAuthStateChange: jest.fn(), getSession: jest.fn(async () => ({ data: { session: null } })) }, rpc: jest.fn(), from: jest.fn() } }));
jest.mock('@/services/analytics/analytics', () => ({ track: jest.fn() }));

import AsyncStorage from '@react-native-async-storage/async-storage';

import { newPortfolio, rename } from '@/features/culture/oymo/portfolio/portfolioModel';
import { clearUnrecordedSave, saveGuideDesign, unrecordedSave } from '@/features/firstUse/firstUseModel';
import { draftMap, ownerKey } from '@/services/drafts/draftRegistry';
import { ownerPortfolio, usePortfolioStore } from '@/store/usePortfolioStore';
import { useFirstUseStore } from '@/store/useFirstUseStore';

import { discardEntry, retryEntry } from './recoveryActions';
import { listRecovery, type RecoveryInputs } from './recoveryModel';

const base = (owner: string, change: Partial<RecoveryInputs> = {}): RecoveryInputs => ({ owner, portfolioExists: () => true, scrapbookExists: () => true, question: () => ({ text: 'Q?' }), comparison: () => ({ a: 'A', b: 'B' }), journalDrafts: [], journalEntryExists: () => true, firstUse: null, ...change });

beforeEach(async () => {
  for (const source of ['portfolio', 'scrapbook', 'question', 'compareNote'] as const) draftMap(source).clear();
  clearUnrecordedSave();
  await AsyncStorage.clear();
  usePortfolioStore.setState({ status: 'idle', saved: {} } as never);
  await usePortfolioStore.getState().load();
});

describe('listing', () => {
  it('each draft opens its own editor; only the current owner\'s are listed', () => {
    draftMap('portfolio').set(ownerKey('user-a', 'p1'), newPortfolio('Mine'));
    draftMap('scrapbook').set(ownerKey('user-a', 'sb1'), { id: 'sb1', title: 'Book', entries: [], createdAt: '', updatedAt: '' });
    draftMap('question').set(ownerKey('user-a', 'origin:boz-uy:history'), 'New question?');
    draftMap('question').set(ownerKey('user-a', 'text:q1'), 'Edited');
    draftMap('question').set(ownerKey('user-a', 'answer:q1'), 'Answer');
    draftMap('compareNote').set(ownerKey('user-a', 'c-1'), 'Note');
    draftMap('portfolio').set(ownerKey('user-b', 'p9'), newPortfolio('Not mine'));
    const journalDraft = { v: 1, target: 'new', entryId: 'e1', fields: { title: 'Trip', note: '', date: '', photoUri: null, link: null }, baseUpdatedAt: null, savedAt: '' } as never;
    const list = listRecovery(base('user-a', { journalDrafts: [journalDraft], firstUse: { savedName: 'Guide design' } }));
    expect(list.map((e) => [e.kind, e.route])).toEqual([
      ['portfolio', '/profile/oymo-portfolios/p1'],
      ['scrapbook', '/profile/scrapbooks/sb1'],
      ['questionNew', '/culture/item/boz-uy?section=history'],
      ['questionEdit', '/profile/questions/q1'],
      ['compareNote', '/culture/komuz/compare/c-1'],
      ['journal', '/journal/new'],
      ['firstUse', '/start'],
    ]);
    expect(list.some((e) => e.title === 'Not mine')).toBe(false);
    expect(listRecovery(base('user-b')).map((e) => e.title)).toEqual(['Not mine']);
  });
  it('saved vs unsaved vs pending, and which survive a restart', () => {
    draftMap('portfolio').set(ownerKey('u', 'p1'), newPortfolio('P'));
    const journalDraft = { v: 1, target: 'e5', entryId: 'e5', fields: { title: 'T', note: '', date: '', photoUri: null, link: null }, baseUpdatedAt: null, savedAt: '' } as never;
    const list = listRecovery(base('u', { journalDrafts: [journalDraft], firstUse: { savedName: 'X' } }));
    expect(list.map((e) => [e.kind, e.state, e.survivesRestart])).toEqual([['portfolio', 'unsaved', false], ['journal', 'unsaved', true], ['firstUse', 'pending', false]]);
  });
  it('never offers retry where it could create a record; a missing parent is explicit', () => {
    draftMap('portfolio').set(ownerKey('u', 'gone'), newPortfolio('Deleted one'));
    draftMap('question').set(ownerKey('u', 'origin:a:b'), 'New?');
    const journalDraft = { v: 1, target: 'new', entryId: 'e1', fields: { title: 'x', note: '', date: '', photoUri: null, link: null }, baseUpdatedAt: null, savedAt: '' } as never;
    const list = listRecovery(base('u', { portfolioExists: () => false, journalDrafts: [journalDraft] }));
    expect(list.find((e) => e.kind === 'portfolio')).toMatchObject({ parent: 'missing', retry: false });
    expect(list.find((e) => e.kind === 'questionNew')?.retry).toBe(false);
    expect(list.find((e) => e.kind === 'journal')?.retry).toBe(false);
  });
});

describe('retry', () => {
  it('a safe retry saves the draft as it is now, then clears it - and keeps edits made during the retry', async () => {
    const stored = newPortfolio('Stored');
    await usePortfolioStore.getState().save('u', stored);
    const sent = rename(stored, 'Edited offline');
    const map = draftMap('portfolio');
    map.set(ownerKey('u', stored.id), sent);
    const [entry] = listRecovery(base('u'));
    // An edit lands while the retry is being written:
    const real = usePortfolioStore.getState().save;
    usePortfolioStore.setState({ save: async (owner: string, p: never) => { map.set(ownerKey('u', stored.id), rename(sent, 'Typed meanwhile')); return real(owner, p); } } as never);
    expect(await retryEntry('u', entry)).toBe(true);
    usePortfolioStore.setState({ save: real } as never);
    expect(ownerPortfolio(usePortfolioStore.getState().saved, 'u', stored.id)?.title).toBe('Edited offline');
    expect((map.get(ownerKey('u', stored.id)) as { title: string }).title).toBe('Typed meanwhile');
  });
  it('a failed retry keeps the draft', async () => {
    const stored = newPortfolio('Stored');
    await usePortfolioStore.getState().save('u', stored);
    draftMap('portfolio').set(ownerKey('u', stored.id), rename(stored, 'Edit'));
    const realSet = AsyncStorage.setItem;
    AsyncStorage.setItem = () => Promise.reject(new Error('disk'));
    try {
      expect(await retryEntry('u', listRecovery(base('u'))[0])).toBe(false);
    } finally {
      AsyncStorage.setItem = realSet;
    }
    expect(draftMap('portfolio').has(ownerKey('u', stored.id))).toBe(true);
  });
  it('recovery cannot repeat an already successful creation: the guide retry only records the step', async () => {
    useFirstUseStore.setState({ status: 'idle', saved: {} });
    await useFirstUseStore.getState().load();
    await useFirstUseStore.getState().start('u');
    for (const step of ['article', 'create'] as const) await useFirstUseStore.getState().done('u', step);
    const save = jest.fn(async () => true);
    await saveGuideDesign({ owner: 'u', savedName: 'Mine', save, markSaved: async () => false });
    const entry = listRecovery(base('u', { firstUse: unrecordedSave('u') })).find((e) => e.kind === 'firstUse')!;
    expect(await retryEntry('u', entry)).toBe(true);
    expect(save).toHaveBeenCalledTimes(1);
    expect(unrecordedSave('u')).toBeNull();
  });
  it('an unsafe entry is never retried', async () => {
    draftMap('question').set(ownerKey('u', 'origin:a:b'), 'New?');
    expect(await retryEntry('u', listRecovery(base('u'))[0])).toBe(false);
  });
});

describe('discard', () => {
  it('discards one draft only; saved records stay', async () => {
    const stored = newPortfolio('Stored');
    await usePortfolioStore.getState().save('u', stored);
    draftMap('portfolio').set(ownerKey('u', stored.id), rename(stored, 'Edit'));
    draftMap('compareNote').set(ownerKey('u', 'c-1'), 'Keep me');
    const entry = listRecovery(base('u')).find((e) => e.kind === 'portfolio')!;
    await discardEntry('u', entry);
    expect(draftMap('portfolio').has(ownerKey('u', stored.id))).toBe(false);
    expect(draftMap('compareNote').get(ownerKey('u', 'c-1'))).toBe('Keep me');
    expect(ownerPortfolio(usePortfolioStore.getState().saved, 'u', stored.id)?.title).toBe('Stored');
  });
});
