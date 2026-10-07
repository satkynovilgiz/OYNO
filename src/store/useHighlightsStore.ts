import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { mergeHighlights, removeHighlight, savePassage, setNote, type ContentHighlight, type HighlightContentType, type HighlightsData } from '@/features/culture/highlights/highlightsModel';
import { safeJsonParse } from '@/services/storage/safeJson';

export const HIGHLIGHTS_KEY = 'oyno.highlights.v1';

type Saved = Record<string, HighlightsData>;
const EMPTY: HighlightsData = {};

export function ownerHighlights(saved: Saved, owner: string): HighlightsData {
  return saved[owner] ?? EMPTY;
}

type State = {
  isLoaded: boolean;
  saved: Saved;
  load: () => Promise<void>;
  save: (owner: string, input: { contentType: HighlightContentType; contentId: string; sectionKey: string; language: string; title: string; text: string }) => { highlight: ContentHighlight; created: boolean };
  setNote: (owner: string, id: string, note: string) => void;
  remove: (owner: string, id: string) => void;
  /** Private Cloud Sync: the merged account state (null = forget this owner on this device). */
  applySynced: (owner: string, data: HighlightsData | null) => void;
  adoptGuest: (userId: string) => void;
};

/** Private highlights + notes - ON THIS DEVICE per account owner (v1,
 * not synced). Separate from Saved, Reading progress and the Journal. */
export const useHighlightsStore = create<State>((set, get) => {
  const persist = () => void AsyncStorage.setItem(HIGHLIGHTS_KEY, JSON.stringify(get().saved)).catch(() => undefined);
  const update = (owner: string, next: HighlightsData) => {
    if (next === ownerHighlights(get().saved, owner)) return;
    set({ saved: { ...get().saved, [owner]: next } });
    persist();
  };
  return {
    isLoaded: false,
    saved: {},
    load: async () => {
      if (get().isLoaded) return;
      const raw = await AsyncStorage.getItem(HIGHLIGHTS_KEY).catch(() => null);
      // A load that finishes late never overwrites a store already loaded (and written) meanwhile.
      if (get().isLoaded) return;
      const parsed = safeJsonParse<Saved>(raw, {});
      set({ saved: parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}, isLoaded: true });
    },
    save: (owner, input) => {
      const result = savePassage(ownerHighlights(get().saved, owner), input);
      update(owner, result.data);
      return { highlight: result.highlight, created: result.created };
    },
    setNote: (owner, id, note) => update(owner, setNote(ownerHighlights(get().saved, owner), id, note)),
    remove: (owner, id) => update(owner, removeHighlight(ownerHighlights(get().saved, owner), id)),
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
      const saved = { ...get().saved, [userId]: mergeHighlights(ownerHighlights(get().saved, userId), guest) };
      delete saved.guest;
      set({ saved });
      persist();
    },
  };
});
