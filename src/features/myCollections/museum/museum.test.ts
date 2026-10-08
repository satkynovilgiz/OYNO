import AsyncStorage from '@react-native-async-storage/async-storage';
import * as fs from 'fs';
import * as path from 'path';

import { MY_MUSEUMS_KEY, ownerCollections, ownerExhibition, useMyCollectionsStore } from '@/store/useMyCollectionsStore';

import { buildExhibitionCover, emptyExhibition, exhibitKey, MAX_EXHIBITS, moveExhibit, normalizeExhibition, setCaption, slidesFor, toggleExhibit, type Exhibition } from './museumModel';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));

// Synthetic text only.
const CAPTION_A = 'Synthetic caption by account A 7g';
const INTRO = 'Synthetic introduction 2k';
const ITEMS = ['boz-uy-overview', 'boz-uy-tunduk', 'shyrdak-craft', 'horse-eer', 'horse-kok-boru', 'oymo-umai-ene', 'horse-jylky', 'boz-uy-karkas', 'horse-oodarysh', 'shyrdak-tustor'];

function seedCollection(owner: string, count = ITEMS.length) {
  const store = useMyCollectionsStore.getState();
  const collection = store.create(owner, { name: 'Felt and yurts', description: 'private description 9z' });
  for (const id of ITEMS.slice(0, count)) store.add(owner, collection.id, 'culture_item', id);
  return collection;
}
const resolver = (missing: string[] = [], noImage: string[] = []) => (contentType: string, contentId: string) =>
  missing.includes(contentId) ? null : { title: `Title of ${contentId}`, route: `/culture/item/${contentId}`, thumbnail: noImage.includes(contentId) ? null : 42 };
async function restart() {
  useMyCollectionsStore.setState({ isLoaded: false, saved: {}, museums: {} });
  await new Promise((resolve) => setTimeout(resolve, 0));
  await useMyCollectionsStore.getState().load();
}

beforeEach(async () => {
  await AsyncStorage.clear();
  useMyCollectionsStore.setState({ isLoaded: true, saved: {}, museums: {} });
});

describe('arranging exhibits', () => {
  it('starts from the collection (up to 8, in its order) and keeps a chosen order across a restart', async () => {
    const collection = seedCollection('guest');
    const data = ownerCollections(useMyCollectionsStore.getState().saved, 'guest');
    let exhibition = emptyExhibition(collection, data, collection.id);
    expect(exhibition.exhibits).toHaveLength(MAX_EXHIBITS);
    exhibition = moveExhibit(exhibition, 2, -1);
    exhibition = moveExhibit(exhibition, 0, 1);
    useMyCollectionsStore.getState().saveExhibition('guest', collection.id, exhibition);
    await restart();
    const saved = normalizeExhibition(ownerExhibition(useMyCollectionsStore.getState().museums, 'guest', collection.id), ownerCollections(useMyCollectionsStore.getState().saved, 'guest'), collection.id)!;
    expect(saved.exhibits).toEqual(exhibition.exhibits);
    expect(saved.exhibits.slice(0, 3)).toEqual(['culture_item:shyrdak-craft', 'culture_item:boz-uy-overview', 'culture_item:boz-uy-tunduk']);
  });

  it('never more than 8; a removed exhibit makes room; captions follow their exhibit', () => {
    const collection = seedCollection('guest');
    const data = ownerCollections(useMyCollectionsStore.getState().saved, 'guest');
    let exhibition = emptyExhibition(collection, data, collection.id);
    const ninth = 'culture_item:horse-oodarysh';
    expect(toggleExhibit(exhibition, ninth)).toBe(exhibition);
    exhibition = setCaption(exhibition, 'culture_item:boz-uy-tunduk', CAPTION_A);
    exhibition = toggleExhibit(exhibition, 'culture_item:boz-uy-tunduk');
    expect(exhibition.captions).toEqual({});
    exhibition = toggleExhibit(exhibition, ninth);
    expect(exhibition.exhibits).toContain(ninth);
    expect(setCaption(exhibition, 'culture_item:not-shown', 'x')).toBe(exhibition);
  });

  it('normalizing drops items no longer in the collection, duplicates, extras and markup', () => {
    const collection = seedCollection('guest', 3);
    const data = ownerCollections(useMyCollectionsStore.getState().saved, 'guest');
    const tampered = { title: '<b>Exhibit</b>', intro: INTRO, exhibits: ['culture_item:boz-uy-tunduk', 'culture_item:boz-uy-tunduk', 'culture_item:gone', 'region:naryn', 'culture_item:shyrdak-craft'], captions: { 'culture_item:gone': 'x', 'culture_item:shyrdak-craft': CAPTION_A, 'culture_item:boz-uy-overview': 'not shown' }, updatedAt: 'x' };
    expect(normalizeExhibition(tampered, data, collection.id)).toEqual({ title: 'bExhibit/b', intro: INTRO, exhibits: ['culture_item:boz-uy-tunduk', 'culture_item:shyrdak-craft'], captions: { 'culture_item:shyrdak-craft': CAPTION_A }, reflections: {}, lookClosely: { exhibits: [], clues: [] }, story: { cards: [] }, updatedAt: 'x' });
    expect(normalizeExhibition('nope', data, collection.id)).toBeNull();
  });
});

describe('missing content', () => {
  it('removed content and unavailable images are explicit slides, never blank', () => {
    const exhibition: Exhibition = { title: 'T', intro: '', exhibits: ['culture_item:boz-uy-overview', 'culture_item:gone', 'culture_item:horse-eer'], captions: { 'culture_item:gone': CAPTION_A }, updatedAt: '' };
    const slides = slidesFor(exhibition, resolver(['gone'], ['horse-eer']), true);
    expect(slides.map((slide) => slide.kind)).toEqual(['exhibit', 'removed', 'exhibit']);
    expect(slides[1]).toMatchObject({ kind: 'removed', caption: CAPTION_A });
    expect(slides[2].kind === 'exhibit' && slides[2].content.thumbnail).toBeNull();
    // Still loading the catalogue: not called "removed" yet.
    expect(slidesFor(exhibition, resolver(['gone']), false)[1].kind).toBe('loading');
  });

  it('removing an item from the collection removes it from the exhibition', () => {
    const collection = seedCollection('guest', 3);
    const store = useMyCollectionsStore.getState();
    store.saveExhibition('guest', collection.id, emptyExhibition(collection, ownerCollections(store.saved, 'guest'), collection.id));
    store.removeItem('guest', collection.id, 'culture_item', 'boz-uy-tunduk');
    const state = useMyCollectionsStore.getState();
    expect(normalizeExhibition(ownerExhibition(state.museums, 'guest', collection.id), ownerCollections(state.saved, 'guest'), collection.id)!.exhibits).toEqual(['culture_item:boz-uy-overview', 'culture_item:shyrdak-craft']);
  });
});

describe('ownership', () => {
  it("captions are the owner's: another account never reads them", async () => {
    const mine = seedCollection('user-a');
    const store = useMyCollectionsStore.getState();
    store.saveExhibition('user-a', mine.id, setCaption(emptyExhibition(mine, ownerCollections(store.saved, 'user-a'), mine.id), 'culture_item:boz-uy-overview', CAPTION_A));
    expect(ownerExhibition(useMyCollectionsStore.getState().museums, 'user-b', mine.id)).toBeNull();
    // Account B can't write into A's collection id either.
    useMyCollectionsStore.getState().saveExhibition('user-b', mine.id, { title: 'x', intro: '', exhibits: [], captions: {}, updatedAt: '' });
    expect(useMyCollectionsStore.getState().museums['user-b']).toBeUndefined();
    // Forgetting A on this device forgets A's captions.
    useMyCollectionsStore.getState().applySynced('user-a', null);
    expect(useMyCollectionsStore.getState().museums['user-a']).toBeUndefined();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect((await AsyncStorage.getItem(MY_MUSEUMS_KEY)) ?? '').not.toContain(CAPTION_A);
  });

  it('deleting the collection deletes its presentation; a guest presentation follows sign-in', () => {
    const guest = seedCollection('guest');
    const store = useMyCollectionsStore.getState();
    store.saveExhibition('guest', guest.id, setCaption(emptyExhibition(guest, ownerCollections(store.saved, 'guest'), guest.id), 'culture_item:boz-uy-overview', CAPTION_A));
    useMyCollectionsStore.getState().adoptGuest('user-a');
    expect(ownerExhibition(useMyCollectionsStore.getState().museums, 'user-a', guest.id)?.captions['culture_item:boz-uy-overview']).toBe(CAPTION_A);
    expect(useMyCollectionsStore.getState().museums.guest).toBeUndefined();
    useMyCollectionsStore.getState().remove('user-a', guest.id);
    expect(ownerExhibition(useMyCollectionsStore.getState().museums, 'user-a', guest.id)).toBeNull();
  });
});

describe('sharing', () => {
  it('the cover holds only what the preview shows: title, count, label, one picture - intro only when switched on', () => {
    const off = buildExhibitionCover({ title: 'My exhibition', exhibitCountLabel: '3 exhibits', label: 'My Mini Museum', cover: 42, intro: null });
    expect(off).toEqual({ title: 'My exhibition', label: 'My Mini Museum', subtitle: '3 exhibits', imageSource: 42, excerpt: null, fallbackTone: expect.any(String) });
    expect(buildExhibitionCover({ title: 'T', exhibitCountLabel: '1', label: 'L', cover: null, intro: `  ${INTRO}  ` }).excerpt).toBe(INTRO);
  });

  it('captions, the private description, journal text, notes and photos are not even inputs', () => {
    const screen = fs.readFileSync(path.join(__dirname, 'MiniMuseumScreen.tsx'), 'utf8');
    const call = screen.slice(screen.indexOf('buildExhibitionCover({'), screen.indexOf('});', screen.indexOf('buildExhibitionCover({')));
    expect(call).not.toMatch(/caption|description|journal|note|photo/i);
    // The same object is previewed and shared (the share sheet previews its content).
    expect(screen).toContain('share(cover, exhibitionTitle)');
    expect(screen).toContain("intro: includeIntro ? exhibition.intro : null");
    expect(screen).toContain('useState(false)'); // include intro: off by default
  });

  it('exhibit keys match collection items', () => {
    expect(exhibitKey({ contentType: 'culture_item', contentId: 'boz-uy-tunduk' })).toBe('culture_item:boz-uy-tunduk');
  });
});
