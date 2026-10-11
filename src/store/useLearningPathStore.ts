import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { safeJsonParse } from '@/services/storage/safeJson';
import { createSerialQueue } from '@/services/storage/serialWrites';

const queue = createSerialQueue();

export const LEARNING_PATH_KEY = 'oyno.learningPaths.v1';

/** pathId -> stepId -> completedAt (ISO). ONLY for steps without a real
 * completion signal ("Mark step complete"); everything else is derived. */
export type ManualSteps = Record<string, Record<string, string>>;
type Saved = Record<string, ManualSteps>;
const EMPTY: ManualSteps = {};

export function ownerManualSteps(saved: Saved, owner: string): ManualSteps {
  return saved[owner] ?? EMPTY;
}

/** Pure: guest -> account (union; earliest completion kept). */
export function mergeManualSteps(into: ManualSteps, from: ManualSteps): ManualSteps {
  const merged: ManualSteps = { ...into };
  for (const [pathId, steps] of Object.entries(from)) {
    const current = { ...(merged[pathId] ?? {}) };
    for (const [stepId, at] of Object.entries(steps)) if (!current[stepId] || at < current[stepId]) current[stepId] = at;
    merged[pathId] = current;
  }
  return merged;
}

type State = {
  isLoaded: boolean;
  saved: Saved;
  load: () => Promise<void>;
  /** Written to storage first, then shown; resolves false when the write failed (nothing changed). */
  setManual: (owner: string, pathId: string, stepId: string, completed: boolean) => Promise<boolean>;
  /** Restart a path: forgets its manual completions (write-first, like setManual). */
  clearPath: (owner: string, pathId: string) => Promise<boolean>;
  /** Private Cloud Sync: the merged account state (null = forget this owner on this device). */
  applySynced: (owner: string, data: ManualSteps | null) => void;
  adoptGuest: (userId: string) => void;
};

/** Learning Path manual step completions - on this device, per owner. */
export const useLearningPathStore = create<State>((set, get) => {
  const persist = () => void AsyncStorage.setItem(LEARNING_PATH_KEY, JSON.stringify(get().saved)).catch(() => undefined);
  // One read at a time: a second load() joins the first, so a later read can
  // never overwrite a change applied after the first one finished.
  let loading: Promise<void> | null = null;
  // Writes wait for the stored state: persisting before it is read would
  // replace every saved completion (all owners) with just this change.
  const whenLoaded = (apply: () => void) => {
    if (get().isLoaded) apply();
    else void get().load().then(apply);
  };
  /** Serialized, from the latest state, storage first - then published. */
  const writeManual = (owner: string, change: (mine: ManualSteps) => ManualSteps | null) =>
    queue(async () => {
      await get().load();
      const mine = ownerManualSteps(get().saved, owner);
      const next = change(mine);
      if (next === null) return true;
      const saved = { ...get().saved, [owner]: next };
      try {
        await AsyncStorage.setItem(LEARNING_PATH_KEY, JSON.stringify(saved));
      } catch {
        return false;
      }
      set({ saved: { ...get().saved, [owner]: next } });
      return true;
    });
  return {
    isLoaded: false,
    saved: {},
    load: () => {
      if (get().isLoaded) return Promise.resolve();
      loading ??= (async () => {
        const raw = await AsyncStorage.getItem(LEARNING_PATH_KEY).catch(() => null);
        const parsed = safeJsonParse<Saved>(raw, {});
        set({ saved: parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}, isLoaded: true });
      })().finally(() => {
        loading = null;
      });
      return loading;
    },
    setManual: (owner, pathId, stepId, completed) =>
      writeManual(owner, (mine) => {
        const steps = { ...(mine[pathId] ?? {}) };
        if (completed) steps[stepId] = steps[stepId] ?? new Date().toISOString();
        else delete steps[stepId];
        return { ...mine, [pathId]: steps };
      }),
    clearPath: (owner, pathId) =>
      writeManual(owner, (mine) => {
        if (!mine[pathId]) return null;
        const next = { ...mine };
        delete next[pathId];
        return next;
      }),
    applySynced: (owner, data) =>
      whenLoaded(() => {
        const saved = { ...get().saved };
        if (data) saved[owner] = data;
        else delete saved[owner];
        set({ saved });
        persist();
      }),
    adoptGuest: (userId) => {
      const guest = get().saved.guest;
      if (!guest || userId === 'guest') return;
      const saved = { ...get().saved, [userId]: mergeManualSteps(ownerManualSteps(get().saved, userId), guest) };
      delete saved.guest;
      set({ saved });
      persist();
    },
  };
});
