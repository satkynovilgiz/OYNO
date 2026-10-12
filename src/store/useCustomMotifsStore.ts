import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { validateMotif, type CustomMotif } from '@/features/culture/oymo/customMotif/customMotifModel';
import { createSerialQueue } from '@/services/storage/serialWrites';

/**
 * User-created motifs, on this device per owner (format v1, validated on
 * load - anything unsupported is skipped, never "fixed"). Serialized,
 * write-first; an unreadable store blocks writes (Retry). Not synced.
 */
export const CUSTOM_MOTIFS_KEY = 'oyno.customMotifs.v1';
export const MAX_CUSTOM_MOTIFS = 40;
type Saved = Record<string, Record<string, unknown>>;
const queue = createSerialQueue();

type State = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  saved: Saved;
  load: () => Promise<void>;
  retryLoad: () => Promise<void>;
  save: (owner: string, motif: CustomMotif) => Promise<boolean>;
  remove: (owner: string, id: string) => Promise<boolean>;
};

export function ownerMotifs(saved: Saved, owner: string): CustomMotif[] {
  return Object.values(saved[owner] ?? {})
    .map(validateMotif)
    .filter((m): m is CustomMotif => !!m)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export const useCustomMotifsStore = create<State>((set, get) => {
  const write = (owner: string, change: (mine: Record<string, unknown>) => Record<string, unknown> | null) =>
    queue(async () => {
      if (get().status !== 'ready') return false;
      const mine = { ...(get().saved[owner] ?? {}) };
      const next = change(mine);
      if (!next) return false;
      try {
        await AsyncStorage.setItem(CUSTOM_MOTIFS_KEY, JSON.stringify({ ...get().saved, [owner]: next }));
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
        raw = await AsyncStorage.getItem(CUSTOM_MOTIFS_KEY);
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
    save: (owner, motif) =>
      write(owner, (mine) => {
        const valid = validateMotif({ ...motif, updatedAt: new Date().toISOString() });
        if (!valid) return null;
        if (!mine[valid.id] && Object.keys(mine).length >= MAX_CUSTOM_MOTIFS) return null;
        return { ...mine, [valid.id]: valid };
      }),
    remove: (owner, id) =>
      write(owner, (mine) => {
        const next = { ...mine };
        delete next[id];
        return next;
      }),
  };
});
