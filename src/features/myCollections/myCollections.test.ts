import * as fs from 'fs';
import * as path from 'path';

import AsyncStorage from '@react-native-async-storage/async-storage';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import { ownerCollections, useMyCollectionsStore } from '@/store/useMyCollectionsStore';

import { buildMyCollectionShareCard } from './myCollectionShare';
import {
  addItem,
  collectionEventProps,
  coverFor,
  createCollection,
  deleteCollection,
  editCollection,
  EMPTY_COLLECTIONS,
  filterEntries,
  itemsOf,
  mergeCollections,
  moveItem,
  removeItem,
  resolveEntries,
  validateDescription,
  validateName,
  type CollectionsData,
} from './myCollectionsModel';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));

const T0 = new Date('2026-10-01T10:00:00Z');
const later = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);
function withCollections(...names: string[]): { data: CollectionsData; ids: string[] } {
  let data = EMPTY_COLLECTIONS;
  const ids: string[] = [];
  names.forEach((name, index) => {
    const created = createCollection(data, { name }, later(index));
    data = created.data;
    ids.push(created.collection.id);
  });
  return { data, ids };
}

describe('My Collections - model', () => {
  it('create: trimmed name, optional description, user text kept as typed', () => {
    const { data, collection } = createCollection(EMPTY_COLLECTIONS, { name: '  Кыргыз тамактары ', description: '' }, T0);
    expect(collection).toMatchObject({ name: 'Кыргыз тамактары', description: null, createdAt: T0.toISOString(), updatedAt: T0.toISOString() });
    expect(data.collections).toHaveLength(1);
  });

  it('rename and description validation (name <= 60, description <= 240, no markup)', () => {
    expect(validateName('')).toBe('empty');
    expect(validateName('x'.repeat(61))).toBe('tooLong');
    expect(validateName('<b>Hi</b>')).toBe('markup');
    expect(validateName('Learn later')).toBeNull();
    expect(validateDescription('x'.repeat(241))).toBe('tooLong');
    expect(validateDescription('{x}')).toBe('markup');
    expect(validateDescription('')).toBeNull();
    const { data, ids } = withCollections('Learn later');
    const edited = editCollection(data, ids[0], { name: 'Later', description: 'Weekend reading' }, later(5));
    expect(edited.collections[0]).toMatchObject({ name: 'Later', description: 'Weekend reading', updatedAt: later(5).toISOString() });
    expect(() => editCollection(data, ids[0], { name: 'x'.repeat(61), description: null })).toThrow();
  });

  it('add item; the same item twice in ONE collection is prevented', () => {
    const { data, ids } = withCollections('Learn later');
    const once = addItem(data, ids[0], 'culture_item', 'boorsok', later(1));
    expect(addItem(once, ids[0], 'culture_item', 'boorsok', later(2))).toBe(once);
    expect(itemsOf(once, ids[0])).toEqual([{ collectionId: ids[0], contentType: 'culture_item', contentId: 'boorsok', sortOrder: 0, addedAt: later(1).toISOString() }]);
  });

  it('the same item can be in several collections', () => {
    const { data, ids } = withCollections('Кыргыз тамактары', 'Learn later');
    const both = addItem(addItem(data, ids[0], 'culture_item', 'boorsok'), ids[1], 'culture_item', 'boorsok');
    expect(itemsOf(both, ids[0])).toHaveLength(1);
    expect(itemsOf(both, ids[1])).toHaveLength(1);
  });

  it('reorder with move up / move down', () => {
    const { data, ids } = withCollections('Mix');
    let mixed = data;
    for (const id of ['komuz', 'boorsok', 'boz-uy']) mixed = addItem(mixed, ids[0], 'culture_item', id);
    const moved = moveItem(mixed, ids[0], 2, -1);
    expect(itemsOf(moved, ids[0]).map((item) => item.contentId)).toEqual(['komuz', 'boz-uy', 'boorsok']);
    expect(moveItem(mixed, ids[0], 0, -1)).toBe(mixed);
  });

  it('removing an item removes only that membership', () => {
    const { data, ids } = withCollections('A', 'B');
    const both = addItem(addItem(data, ids[0], 'game', 'kok-boru'), ids[1], 'game', 'kok-boru');
    const removed = removeItem(both, ids[0], 'game', 'kok-boru');
    expect(itemsOf(removed, ids[0])).toEqual([]);
    expect(itemsOf(removed, ids[1])).toHaveLength(1);
    // The collections code never touches favorites, progress or the Journal.
    for (const file of ['myCollectionsModel.ts', '../../store/useMyCollectionsStore.ts', 'MyCollectionDetailScreen.tsx']) {
      expect(fs.readFileSync(path.join(__dirname, file), 'utf8')).not.toMatch(/useFavoritesStore|toggleFavorite|useProgressStore|useJournalStore/);
    }
  });

  it('delete collection removes it and its memberships only', () => {
    const { data, ids } = withCollections('A', 'B');
    const filled = addItem(addItem(data, ids[0], 'trail', 't1'), ids[1], 'trail', 't1');
    const after = deleteCollection(filled, ids[0]);
    expect(after.collections.map((collection) => collection.id)).toEqual([ids[1]]);
    expect(after.items).toHaveLength(1);
  });

  it('missing content resolves to "unavailable" (null), never a crash; the cover falls back', () => {
    const { data, ids } = withCollections('Mix');
    const filled = addItem(addItem(data, ids[0], 'culture_item', 'gone'), ids[0], 'game', 'ordo');
    const entries = resolveEntries(filled, ids[0], (type, id) => (type === 'game' ? { title: id, route: `/games/${id}`, thumbnail: 7 } : null));
    expect(entries[0].content).toBeNull();
    expect(coverFor(entries)).toBe(7);
    expect(coverFor(entries.slice(0, 1))).toBeNull();
    expect(filterEntries(entries, 'ord')).toHaveLength(1);
  });

  it('guest -> account merge: union, no duplicates, newer updatedAt wins, account order first', () => {
    const account = withCollections('Account list');
    const guest = withCollections('Guest list');
    const accountData = addItem(account.data, account.ids[0], 'game', 'ordo');
    const guestData = addItem(guest.data, guest.ids[0], 'game', 'chuko');
    const merged = mergeCollections(accountData, guestData);
    expect(merged.collections.map((collection) => collection.name)).toEqual(['Account list', 'Guest list']);
    const sameId = { ...accountData, collections: [{ ...accountData.collections[0], name: 'Newer', updatedAt: '2099-01-01T00:00:00.000Z' }], items: accountData.items };
    expect(mergeCollections(accountData, sameId).collections[0].name).toBe('Newer');
    expect(mergeCollections(accountData, accountData).items).toHaveLength(1);
  });
});

describe('My Collections - storage and accounts', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useMyCollectionsStore.setState({ isLoaded: false, saved: {} });
  });

  it('guest collections persist on the device', async () => {
    await useMyCollectionsStore.getState().load();
    const collection = useMyCollectionsStore.getState().create('guest', { name: 'Learn later' });
    useMyCollectionsStore.getState().add('guest', collection.id, 'culture_item', 'komuz');
    await new Promise((resolve) => setTimeout(resolve, 0));
    useMyCollectionsStore.setState({ isLoaded: false, saved: {} });
    await useMyCollectionsStore.getState().load();
    const data = ownerCollections(useMyCollectionsStore.getState().saved, 'guest');
    expect(data.collections.map((entry) => entry.name)).toEqual(['Learn later']);
    expect(data.items).toHaveLength(1);
  });

  it('guest -> A adopts; A -> sign out -> B never sees A', async () => {
    await useMyCollectionsStore.getState().load();
    useMyCollectionsStore.getState().create('guest', { name: 'Guest one' });
    useMyCollectionsStore.getState().adoptGuest('user-a');
    useMyCollectionsStore.getState().create('user-a', { name: 'Private A' });
    const saved = useMyCollectionsStore.getState().saved;
    expect(ownerCollections(saved, 'user-a').collections.map((entry) => entry.name)).toEqual(['Guest one', 'Private A']);
    expect(ownerCollections(saved, 'guest')).toEqual(EMPTY_COLLECTIONS);
    expect(ownerCollections(saved, 'user-b')).toEqual(EMPTY_COLLECTIONS);
    const hook = fs.readFileSync(path.join(__dirname, 'useMyCollections.ts'), 'utf8');
    expect(hook).toMatch(/ownerCollections\(saved, owner\)/);
    expect(fs.readFileSync(path.join(__dirname, '../../services/sync/accountLifecycle.ts'), 'utf8')).toMatch(/useMyCollectionsStore\.getState\(\)\.adoptGuest\(userId\)/);
  });
});

describe('My Collections - privacy, analytics, strings', () => {
  it('analytics never carries a collection name or description', () => {
    expect(collectionEventProps('culture_item')).toEqual({ content_type: 'culture_item' });
    const hook = fs.readFileSync(path.join(__dirname, 'useMyCollections.ts'), 'utf8');
    for (const call of hook.match(/track\([^)]*\)/g) ?? []) expect(call).not.toMatch(/name|description/);
  });

  it('share card: name, item count, branding label - never the description', () => {
    const card = buildMyCollectionShareCard({ name: 'Learn later', itemCountLabel: '4 items', label: 'My Collections', cover: null });
    expect(Object.keys(card).sort()).toEqual(['fallbackTone', 'imageSource', 'label', 'subtitle', 'title']);
    expect(JSON.stringify(card)).not.toMatch(/description|@|user/i);
  });

  it('KG / RU / EN UI keys exist; user names are never translated', () => {
    const keys = ['title', 'new', 'create', 'addTo', 'added', 'remove', 'rename', 'delete', 'edit', 'emptyTitle', 'browse', 'items', 'moveUp', 'moveDown'];
    for (const dict of [kg, ru, en]) {
      const block = (dict as unknown as { myCollections: Record<string, string> }).myCollections;
      for (const key of keys) expect(block[key]).toBeTruthy();
    }
    const detail = fs.readFileSync(path.join(__dirname, 'MyCollectionDetailScreen.tsx'), 'utf8');
    expect(detail).not.toMatch(/t\(collection\.name|t\(`\$\{collection/);
  });
});
