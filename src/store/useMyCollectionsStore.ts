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
import type { Exhibition } from '@/features/myCollections/museum/museumModel';
import { referencedAudio, releasedAudio } from '@/features/myCollections/museum/narrationModel';
import { narrationAudio } from '@/services/museum/narrationAudio';
import { safeJsonParse } from '@/services/storage/safeJson';

export const MY_COLLECTIONS_KEY = 'oyno.myCollections.v1';
/** Mini Museum presentations: owner -> collection id -> exhibition (private captions included). */
export const MY_MUSEUMS_KEY = 'oyno.myCollections.museums.v1';

/** owner ('guest' or account id) -> that owner's collections. */
type Saved = Record<string, CollectionsData>;
type Museums = Record<string, Record<string, Exhibition>>;

type State = {
  isLoaded: boolean;
  saved: Saved;
  /** Mini Museum presentations, per owner and collection - never shown for another owner. */
  museums: Museums;
  load: () => Promise<void>;
  saveExhibition: (owner: string, collectionId: string, exhibition: Exhibition) => void;
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
  const persistMuseums = () => void AsyncStorage.setItem(MY_MUSEUMS_KEY, JSON.stringify(get().museums)).catch(() => undefined);
  /** Recordings no longer referenced by any of the owner's exhibitions are deleted from the device. */
  const deleteAudio = (owner: string, ids: Iterable<string>) => {
    for (const id of ids) void narrationAudio().remove(owner, id).catch(() => undefined);
  };
  const update = (owner: string, change: (data: CollectionsData) => CollectionsData) => {
    set({ saved: { ...get().saved, [owner]: change(ownerCollections(get().saved, owner)) } });
    persist();
  };
  return {
    isLoaded: false,
    saved: {},
    museums: {},
    load: async () => {
      if (get().isLoaded) return;
      const [raw, rawMuseums] = await Promise.all([AsyncStorage.getItem(MY_COLLECTIONS_KEY).catch(() => null), AsyncStorage.getItem(MY_MUSEUMS_KEY).catch(() => null)]);
      // A load that finishes late never overwrites a store already loaded (and written) meanwhile.
      if (get().isLoaded) return;
      const parsed = safeJsonParse<Saved>(raw, {});
      const museums = safeJsonParse<Museums>(rawMuseums, {});
      // Exhibitions are re-checked against their collection on every read (museumModel.normalizeExhibition).
      set({ saved: parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}, museums: museums && typeof museums === 'object' && !Array.isArray(museums) ? museums : {}, isLoaded: true });
    },
    saveExhibition: (owner, collectionId, exhibition) => {
      if (!ownerCollections(get().saved, owner).collections.some((collection) => collection.id === collectionId)) return;
      const before = get().museums[owner]?.[collectionId];
      set({ museums: { ...get().museums, [owner]: { ...get().museums[owner], [collectionId]: exhibition } } });
      persistMuseums();
      // A removed exhibit's narration recording goes with it.
      deleteAudio(owner, releasedAudio(before, exhibition));
    },
    create: (owner, input) => {
      const { data, collection } = createCollection(ownerCollections(get().saved, owner), input);
      update(owner, () => data);
      return collection;
    },
    edit: (owner, id, input) => update(owner, (data) => editCollection(data, id, input)),
    remove: (owner, id) => {
      update(owner, (data) => deleteCollection(data, id));
      // Its presentation (and private captions) go with it.
      if (get().museums[owner]?.[id]) {
        const mine = { ...get().museums[owner] };
        const gone = referencedAudio({ [id]: mine[id] });
        delete mine[id];
        set({ museums: { ...get().museums, [owner]: mine } });
        persistMuseums();
        deleteAudio(owner, gone);
      }
    },
    add: (owner, collectionId, contentType, contentId) => update(owner, (data) => addItem(data, collectionId, contentType, contentId)),
    removeItem: (owner, collectionId, contentType, contentId) => update(owner, (data) => removeItem(data, collectionId, contentType, contentId)),
    move: (owner, collectionId, index, delta) => update(owner, (data) => moveItem(data, collectionId, index, delta)),
    applySynced: (owner, data) => {
      const saved = { ...get().saved };
      if (data) saved[owner] = data;
      else delete saved[owner];
      set({ saved });
      persist();
      // Forgetting an owner on this device forgets their presentations too.
      if (!data && get().museums[owner]) {
        const museums = { ...get().museums };
        deleteAudio(owner, referencedAudio(museums[owner]));
        delete museums[owner];
        set({ museums });
        persistMuseums();
      }
    },
    adoptGuest: (userId) => {
      const guest = get().saved.guest;
      if (!guest || userId === 'guest') return;
      const saved = { ...get().saved, [userId]: mergeCollections(ownerCollections(get().saved, userId), guest) };
      delete saved.guest;
      set({ saved });
      persist();
      // The guest's presentations follow their collections (the account's own win).
      const guestMuseums = get().museums.guest;
      if (guestMuseums) {
        const museums = { ...get().museums, [userId]: { ...guestMuseums, ...get().museums[userId] } };
        delete museums.guest;
        set({ museums });
        persistMuseums();
        // Their recordings follow, bound to the account from now on.
        void narrationAudio()
          .reassign('guest', userId)
          .catch(() => undefined);
      }
    },
  };
});

/** The owner's exhibition for one collection (raw - normalize before showing). */
export function ownerExhibition(museums: Museums, owner: string, collectionId: string): Exhibition | null {
  return museums[owner]?.[collectionId] ?? null;
}
