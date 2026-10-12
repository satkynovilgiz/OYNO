import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { applyChange, MAX_QUESTIONS, newQuestion, normalizeQuestions, type Question, type QuestionChange, type QuestionOrigin, type Questions } from '@/features/questions/questionsModel';
import { createSerialQueue } from '@/services/storage/serialWrites';

/**
 * My Questions, on this device per owner. Serialized, write-first: every
 * change is computed from the LATEST state inside the queue, written, then
 * shown; false = not saved (the screen keeps the edit for Retry). A failed
 * or unreadable load is an error state that blocks writes.
 */
export const QUESTIONS_KEY = 'oyno.questions.v1';
type Saved = Record<string, Questions>;
const queue = createSerialQueue();

type State = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  saved: Saved;
  load: () => Promise<void>;
  retryLoad: () => Promise<void>;
  /** Returns the new id, or null when it wasn't saved. */
  create: (owner: string, id: string, text: string, origin: QuestionOrigin | null) => Promise<string | null>;
  change: (owner: string, id: string, changes: QuestionChange[]) => Promise<boolean>;
  remove: (owner: string, id: string) => Promise<boolean>;
};

export const ownerQuestions = (saved: Saved, owner: string): Questions => normalizeQuestions(saved[owner]);

export const useQuestionsStore = create<State>((set, get) => {
  /** `change` returns the next records, null = nothing to do, or 'missing' = the record isn't there (not saved). */
  const mutate = (owner: string, change: (current: Questions) => Questions | null | 'missing', onNoChange: boolean) =>
    queue(async () => {
      if (get().status !== 'ready') return false;
      const current = ownerQuestions(get().saved, owner);
      const next = change(current);
      if (next === 'missing') return false;
      if (next === null) return onNoChange;
      try {
        await AsyncStorage.setItem(QUESTIONS_KEY, JSON.stringify({ ...get().saved, [owner]: next }));
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
        raw = await AsyncStorage.getItem(QUESTIONS_KEY);
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
    create: async (owner, id, text, origin) => {
      const ok = await mutate(owner, (current) => (Object.keys(current).length >= MAX_QUESTIONS || current[id] || !text.trim() ? null : { ...current, [id]: newQuestion(id, text, origin, new Date().toISOString()) }), false);
      return ok ? id : null;
    },
    change: (owner, id, changes) =>
      mutate(owner, (current) => {
        const question = current[id];
        if (!question) return 'missing';
        const now = new Date().toISOString();
        const next = changes.reduce<Question>((q, c) => applyChange(q, c, now), question);
        return next === question ? null : { ...current, [id]: next };
      }, true),
    remove: (owner, id) =>
      mutate(owner, (current) => {
        if (!current[id]) return null;
        const next = { ...current };
        delete next[id];
        return next;
      }, true),
  };
});
