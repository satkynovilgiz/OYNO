import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { createSerialQueue } from '@/services/storage/serialWrites';

/**
 * Learning Path journeys: which steps were VISITED (opened from the path)
 * and which optional steps were SKIPPED - per owner, on this device. Visited
 * never means finished: completion stays the existing signals or the
 * explicit "Mark step complete" (useLearningPathStore).
 *
 * Serialized, write-first: a change is computed from the latest state in the
 * queue, written, then shown. A failed or unreadable load is an error state
 * that blocks writes (Retry).
 */
export const JOURNEYS_KEY = 'oyno.journeys.v1';
export type JourneyRecord = { visited: Record<string, string>; skipped: Record<string, string> };
type Saved = Record<string, Record<string, JourneyRecord>>;
const EMPTY: JourneyRecord = { visited: {}, skipped: {} };
const queue = createSerialQueue();

type State = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  saved: Saved;
  load: () => Promise<void>;
  retryLoad: () => Promise<void>;
  visit: (owner: string, pathId: string, stepId: string) => Promise<boolean>;
  setSkipped: (owner: string, pathId: string, stepId: string, skipped: boolean) => Promise<boolean>;
  clearPath: (owner: string, pathId: string) => Promise<boolean>;
};

const clean = (raw: unknown): JourneyRecord => {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Partial<JourneyRecord>;
  const map = (input: unknown) => Object.fromEntries(Object.entries(input && typeof input === 'object' ? (input as Record<string, unknown>) : {}).filter(([key, at]) => /^[a-z0-9-]{1,60}$/.test(key) && typeof at === 'string')) as Record<string, string>;
  return { visited: map(value.visited), skipped: map(value.skipped) };
};
export const ownerJourney = (saved: Saved, owner: string, pathId: string): JourneyRecord => (saved[owner]?.[pathId] ? clean(saved[owner][pathId]) : EMPTY);

export const useJourneyStore = create<State>((set, get) => {
  const mutate = (owner: string, pathId: string, change: (record: JourneyRecord) => JourneyRecord | null) =>
    queue(async () => {
      if (get().status !== 'ready') return false;
      const next = change(ownerJourney(get().saved, owner, pathId));
      if (next === null) return true;
      const mine = { ...(get().saved[owner] ?? {}), [pathId]: next };
      try {
        await AsyncStorage.setItem(JOURNEYS_KEY, JSON.stringify({ ...get().saved, [owner]: mine }));
      } catch {
        return false;
      }
      set({ saved: { ...get().saved, [owner]: { ...(get().saved[owner] ?? {}), [pathId]: next } } });
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
        raw = await AsyncStorage.getItem(JOURNEYS_KEY);
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
    visit: (owner, pathId, stepId) => mutate(owner, pathId, (record) => (record.visited[stepId] ? null : { ...record, visited: { ...record.visited, [stepId]: new Date().toISOString() } })),
    setSkipped: (owner, pathId, stepId, skipped) =>
      mutate(owner, pathId, (record) => {
        const next = { ...record.skipped };
        if (skipped) next[stepId] = next[stepId] ?? new Date().toISOString();
        else delete next[stepId];
        return { ...record, skipped: next };
      }),
    clearPath: (owner, pathId) => mutate(owner, pathId, () => ({ visited: {}, skipped: {} })),
  };
});
