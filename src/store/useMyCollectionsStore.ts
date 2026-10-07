import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import {
  addItem,
  createCollection,
  deleteCollection,
  editCollection,
  EMPTY_COLLECTIONS,
  mergeCollections,
  moveItem,
  removeItem,
  type CollectionContentType,
  type CollectionsData,
  type UserCollection,
} from '@/features/myCollections/myCollectionsModel';
import { safeJsonParse } from '@/services/storage/safeJson';

export const MY_COLLECTIONS_KEY = 'oyno.myCollections.v1';

/** owner ('guest' or account id) -> that owner's collections. */
type Saved = Record<string, CollectionsData>;

type State = {
  isLoaded: boolean;
  saved: Saved;
  load: () => Promise<void>;
  create: (owner: string, input: { name: string; description?: string | null }) => UserCollection;
  edit: (owner: string, id: string, input: { name: string; description: string | null }) => void;
  remove: (owner: string, id: string) => void;
  add: (owner: string, collectionId: string, contentType: CollectionContentType, contentId: string) => void;
  removeItem: (owner: string, collectionId: string, contentType: string, contentId: string) => void;
  move: (owner: string, collectionId: string, index: number, delta: -1 | 1) => void;
  /** Guest -> signed in: the guest's collections join the account. */
  /** Private Cloud Sync: the merged account state (null = forget this owner on this device). */
  applySynced: (owner: string, data: CollectionsData | null) => void;
  adoptGuest: (userId: string) => void;
};

export function ownerCollections(saved: Saved, owner: string): CollectionsData {
  return saved[owner] ?? EMPTY_COLLECTIONS;
}

/**
 * My Collections, kept ON THIS DEVICE per account owner (v1 - not synced;
 * the screens say so). Screens select by the current owner, so account B
 * never sees account A's collection names or items, not even for a frame.
 */
export const useMyCollectionsStore = create<State>((set, get) => {
  const persist = () => void AsyncStorage.setItem(MY_COLLECTIONS_KEY, JSON.stringify(get().saved)).catch(() => undefined);
  const update = (owner: string, change: (data: CollectionsData) => CollectionsData) => {
    set({ saved: { ...get().saved, [owner]: change(ownerCollections(get().saved, owner)) } });
    persist();
  };
  return {
    isLoaded: false,
    saved: {},
    load: async () => {
      if (get().isLoaded) return;
      const raw = await AsyncStorage.getItem(MY_COLLECTIONS_KEY).catch(() => null);
      // A load that finishes late never overwrites a store already loaded (and written) meanwhile.
      if (get().isLoaded) return;
      const parsed = safeJsonParse<Saved>(raw, {});
      set({ saved: parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}, isLoaded: true });
    },
    create: (owner, input) => {
      const { data, collection } = createCollection(ownerCollections(get().saved, owner), input);
      update(owner, () => data);
      return collection;
    },
    edit: (owner, id, input) => update(owner, (data) => editCollection(data, id, input)),
    remove: (owner, id) => update(owner, (data) => deleteCollection(data, id)),
    add: (owner, collectionId, contentType, contentId) => update(owner, (data) => addItem(data, collectionId, contentType, contentId)),
    removeItem: (owner, collectionId, contentType, contentId) => update(owner, (data) => removeItem(data, collectionId, contentType, contentId)),
    move: (owner, collectionId, index, delta) => update(owner, (data) => moveItem(data, collectionId, index, delta)),
    applySynced: (owner, data) => {
      const saved = { ...get().saved };
      if (data) saved[owner] = data;
      else delete saved[owner];
      set({ saved });
      persist();
    },
    adoptGuest: (userId) => {
      const guest = get().saved.guest;
      if (!guest || userId === 'guest') return;
      const saved = { ...get().saved, [userId]: mergeCollections(ownerCollections(get().saved, userId), guest) };
      delete saved.guest;
      set({ saved });
      persist();
    },
  };
});
