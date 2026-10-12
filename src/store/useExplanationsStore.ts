import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { normalizeExplanations, saveExplanation, type Explanations, type PromptId } from '@/features/explain/explainModel';
import { createSerialQueue } from '@/services/storage/serialWrites';

/**
 * "Explain it yourself" entries, on this device per owner. Serialized,
 * write-first: the previous saved text is replaced only after the new one
 * is written. An unreadable load blocks writes. Not synced, not exported.
 */
export const EXPLANATIONS_KEY = 'oyno.explanations.v1';
type Saved = Record<string, Explanations>;
const queue = createSerialQueue();

type State = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  saved: Saved;
  load: () => Promise<void>;
  retryLoad: () => Promise<void>;
  save: (owner: string, input: { articleId: string; titleSnapshot: string; promptId: PromptId; text: string }) => Promise<boolean>;
  remove: (owner: string, articleId: string) => Promise<boolean>;
};

export const ownerExplanations = (saved: Saved, owner: string): Explanations => normalizeExplanations(saved[owner]);

export const useExplanationsStore = create<State>((set, get) => {
  const mutate = (owner: string, change: (current: Explanations) => Explanations | null) =>
    queue(async () => {
      if (get().status !== 'ready') return false;
      const current = ownerExplanations(get().saved, owner);
      const next = change(current);
      if (next === null) return false;
      if (next === current) return true;
      try {
        await AsyncStorage.setItem(EXPLANATIONS_KEY, JSON.stringify({ ...get().saved, [owner]: next }));
      } catch {
        return false;
      }
      set({ saved: { ...get().saved, [owner]: next } });
      return true;
    });
  return {
    status: 'idle',
    saved: {},
    load: async () => {
      if (get().status === 'ready' || get().status === 'loading') return;
      set({ status: 'loading' });
      let raw: string | null;
      try {
        raw = await AsyncStorage.getItem(EXPLANATIONS_KEY);
      } catch {
        set({ status: 'error' });
        return;
      }
      if (raw === null) return set({ saved: {}, status: 'ready' });
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('shape');
        set({ saved: parsed as Saved, status: 'ready' });
      } catch {
        set({ status: 'error' });
      }
    },
    retryLoad: async () => {
      if (get().status !== 'error') return;
      set({ status: 'idle' });
      await get().load();
    },
    save: (owner, input) =>
      mutate(owner, (current) => {
        if (!input.text.trim()) return null;
        const next = saveExplanation(current[input.articleId], input, new Date().toISOString());
        return next === current[input.articleId] ? current : { ...current, [input.articleId]: next };
      }),
    remove: (owner, articleId) =>
      mutate(owner, (current) => {
        if (!current[articleId]) return current;
        const next = { ...current };
        delete next[articleId];
        return next;
      }),
  };
});
