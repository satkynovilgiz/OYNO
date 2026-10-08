import AsyncStorage from '@react-native-async-storage/async-storage';

import { ownerExhibition, useMyCollectionsStore } from '@/store/useMyCollectionsStore';

import { canPlay, CLUE_MAX, endLookSession, keepLookSession, resumeLookSession, EMPTY_LOOK, LOOK_MAX_CLUES, LOOK_MAX_EXHIBITS, lookReducer, normalizeLook, playableLook, removeClue, setClue, START_LOOK, toggleLookExhibit, type LookClosely } from './lookCloselyModel';
import { normalizeExhibition, slidesFor, toggleExhibit, type Exhibition } from './museumModel';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));

const KEYS = ['culture_item:boz-uy-overview', 'culture_item:boz-uy-tunduk', 'culture_item:shyrdak-craft', 'culture_item:horse-eer', 'culture_item:gone'];
const content: Record<string, { title: string; route: string; thumbnail: null }> = {
  'culture_item:boz-uy-overview': { title: 'Боз үй', route: '/culture/item/boz-uy-overview', thumbnail: null },
  'culture_item:boz-uy-tunduk': { title: 'Түндүк', route: '/culture/item/boz-uy-tunduk', thumbnail: null },
  'culture_item:shyrdak-craft': { title: 'Шырдак', route: '/culture/item/shyrdak-craft', thumbnail: null },
  'culture_item:horse-eer': { title: 'Ээр', route: '/culture/item/horse-eer', thumbnail: null },
};
const resolve = (type: string, id: string) => content[`${type}:${id}`] ?? null;
const exhibition: Exhibition = { title: 't', intro: '', exhibits: KEYS, captions: {}, updatedAt: '' };
const slides = slidesFor(exhibition, resolve, true);
const built = (): LookClosely => {
  let look = EMPTY_LOOK;
  for (const key of KEYS.slice(0, 3)) look = toggleLookExhibit(look, key, true);
  look = setClue(look, { id: 'c1', target: KEYS[1], text: 'Find the round opening at the top.' });
  look = setClue(look, { id: 'c2', target: KEYS[2], text: 'Find the felt with bold shapes.' });
  return look;
};

describe('target validation', () => {
  it('at most three exhibits, only ones that can be shown; a clue must point at one of them', () => {
    let look = built();
    expect(look.exhibits).toHaveLength(LOOK_MAX_EXHIBITS);
    expect(toggleLookExhibit(look, KEYS[3], true)).toBe(look); // full
    expect(toggleLookExhibit(toggleLookExhibit(look, KEYS[0], true), KEYS[4], false).exhibits).not.toContain(KEYS[4]); // unavailable
    expect(setClue(look, { id: 'c3', target: KEYS[3], text: 'Not in the game' })).toBe(look);
    look = setClue(look, { id: 'c3', target: KEYS[0], text: 'x' });
    expect(setClue(look, { id: 'c4', target: KEYS[0], text: 'one too many' }).clues).toHaveLength(LOOK_MAX_CLUES);
    // Removing an exhibit removes the clues that pointed at it.
    expect(toggleLookExhibit(look, KEYS[1], true).clues.map((clue) => clue.id)).toEqual(['c2', 'c3']);
    expect(removeClue(look, 'c2').clues.map((clue) => clue.id)).toEqual(['c1', 'c3']);
  });

  it('saved data is re-checked: exhibits no longer in the exhibition, stray targets, bad ids and markup are dropped', () => {
    const raw = {
      exhibits: [KEYS[0], KEYS[0], 'culture_item:not-in-exhibition', KEYS[1], KEYS[2], KEYS[3]],
      clues: [
        { id: 'c1', target: KEYS[1], text: '<b>Look</b>   up' },
        { id: 'c1', target: KEYS[1], text: 'duplicate id' },
        { id: 'c2', target: KEYS[3], text: 'target outside the game' },
        { id: '../x', target: KEYS[0], text: 'bad id' },
        { id: 'c3', target: KEYS[0], text: 'y'.repeat(400) },
      ],
    };
    expect(normalizeLook(raw, exhibition)).toEqual({ exhibits: [KEYS[0], KEYS[1], KEYS[2]], clues: [{ id: 'c1', target: KEYS[1], text: 'bLook/b up' }, { id: 'c3', target: KEYS[0], text: 'y'.repeat(CLUE_MAX) }] });
    expect(normalizeLook('nope', exhibition)).toEqual(EMPTY_LOOK);
    // An exhibit removed from the exhibition leaves the game with it.
    const data = { collections: [{ id: 'c', name: 'n', description: null, createdAt: '', updatedAt: '' }], items: KEYS.map((key, sortOrder) => ({ collectionId: 'c', contentType: 'culture_item', contentId: key.split(':')[1], sortOrder, addedAt: '' })) } as never;
    const smaller = toggleExhibit({ ...exhibition, lookClosely: built() }, KEYS[1]);
    expect(normalizeExhibition(smaller, data, 'c')!.lookClosely).toEqual({ exhibits: [KEYS[0], KEYS[2]], clues: [{ id: 'c2', target: KEYS[2], text: 'Find the felt with bold shapes.' }] });
  });

  it('needs at least two exhibits and one written clue to play', () => {
    expect(canPlay(built())).toBe(true);
    expect(canPlay({ exhibits: [KEYS[0]], clues: [{ id: 'c1', target: KEYS[0], text: 'x' }] })).toBe(false);
    expect(canPlay({ exhibits: [KEYS[0], KEYS[1]], clues: [{ id: 'c1', target: KEYS[0], text: '  ' }] })).toBe(false);
  });
});

describe('removed content never blocks the game', () => {
  it('the gallery shows only exhibits that can be shown; a clue for a missing one is marked unavailable and can be skipped', () => {
    const look = setClue(toggleLookExhibit(built(), KEYS[0], true), { id: 'c1', target: KEYS[1], text: 'Round opening' });
    const withGone: LookClosely = { exhibits: [KEYS[1], KEYS[2], KEYS[4]], clues: [{ id: 'g', target: KEYS[4], text: 'The removed one' }, ...look.clues.filter((clue) => clue.target !== KEYS[0])] };
    const play = playableLook(withGone, slides);
    expect(play.gallery.map((slide) => slide.key)).toEqual([KEYS[1], KEYS[2]]);
    expect(play.clues.map((clue) => [clue.id, clue.available])).toEqual([['g', false], ['c1', true], ['c2', true]]);
    let session = lookReducer(play.clues, START_LOOK, { type: 'answer', clueId: 'g', key: KEYS[1] });
    expect(session).toBe(START_LOOK); // nothing to answer on an unavailable clue
    session = lookReducer(play.clues, session, { type: 'next' });
    session = lookReducer(play.clues, session, { type: 'answer', clueId: 'c1', key: KEYS[1] });
    expect(session.found).toEqual(['c1']);
  });
});

describe('a visitor session', () => {
  const clues = playableLook(built(), slides).clues;

  it('a wrong answer invites another look (no penalty); the right one is found once; answers after that change nothing', () => {
    let session = lookReducer(clues, START_LOOK, { type: 'answer', clueId: 'c1', key: KEYS[0] });
    expect(session).toEqual({ index: 0, tried: { c1: [KEYS[0]] }, found: [] });
    expect(lookReducer(clues, session, { type: 'answer', clueId: 'c1', key: KEYS[0] })).toBe(session); // same wrong tap twice
    session = lookReducer(clues, session, { type: 'answer', clueId: 'c1', key: KEYS[1] });
    expect(session.found).toEqual(['c1']);
    expect(lookReducer(clues, session, { type: 'answer', clueId: 'c1', key: KEYS[2] })).toBe(session);
    // Only the clue on screen can be answered.
    expect(lookReducer(clues, session, { type: 'answer', clueId: 'c2', key: KEYS[2] })).toBe(session);
  });

  it('navigation is bounded, and restart resets the whole session', () => {
    let session = lookReducer(clues, START_LOOK, { type: 'previous' });
    expect(session).toBe(START_LOOK);
    session = [1, 2, 3, 4].reduce((state) => lookReducer(clues, state, { type: 'next' }), START_LOOK);
    expect(session.index).toBe(clues.length); // the "done" screen
    expect(lookReducer(clues, session, { type: 'restart' })).toEqual(START_LOOK);
  });
});

describe('owner isolation', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useMyCollectionsStore.setState({ isLoaded: true, saved: {}, museums: {} });
  });

  it("a curator's clues belong to them: another account neither reads nor writes them", () => {
    const store = useMyCollectionsStore.getState();
    const collection = store.create('user-a', { name: 'Mine', description: 'Private 2c' });
    for (const key of KEYS.slice(0, 3)) store.add('user-a', collection.id, 'culture_item', key.split(':')[1]);
    store.saveExhibition('user-a', collection.id, { title: 't', intro: '', exhibits: KEYS.slice(0, 3), captions: {}, lookClosely: built(), updatedAt: '' });
    expect(ownerExhibition(useMyCollectionsStore.getState().museums, 'user-b', collection.id)).toBeNull();
    useMyCollectionsStore.getState().saveExhibition('user-b', collection.id, { title: 'x', intro: '', exhibits: [], captions: {}, lookClosely: EMPTY_LOOK, updatedAt: '' });
    expect(useMyCollectionsStore.getState().museums['user-b']).toBeUndefined();
    expect((ownerExhibition(useMyCollectionsStore.getState().museums, 'user-a', collection.id) as Exhibition).lookClosely?.clues).toHaveLength(2);
  });
});

describe('the session in memory', () => {
  it('resumes only for the same owner and collection, and is gone when the game ends', async () => {
    const session = { index: 1, tried: { c1: [KEYS[0]] }, found: ['c1'] };
    keepLookSession('user-a', 'col-1', session);
    expect(resumeLookSession('user-a', 'col-1')).toEqual(session);
    expect(resumeLookSession('user-b', 'col-1')).toBeNull();
    expect(resumeLookSession('user-a', 'col-2')).toBeNull();
    endLookSession();
    expect(resumeLookSession('user-a', 'col-1')).toBeNull();
    // Never written to device storage.
    expect(await AsyncStorage.getAllKeys()).not.toContain(expect.stringMatching(/look/i));
  });
});
