import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { applyWorkspaceChange, normalizeWorkspaces, type OwnerWorkspaces, type WorkspaceChange } from '@/features/workspace/workspaceModel';
import { createSerialQueue } from '@/services/storage/serialWrites';

/**
 * Project workspaces (workspaceModel.ts), on this device per owner: only
 * references to existing projects plus private notes - the projects stay in
 * their own stores. Serialized, write-first: each change is computed from
 * the latest state, written, then shown; false = not saved (nothing
 * changed). An unreadable load is an error that blocks writes (Retry).
 */
export const WORKSPACES_KEY = 'oyno.projectWorkspaces.v1';
type Saved = Record<string, unknown>;
const queue = createSerialQueue();

type State = { status: 'idle' | 'loading' | 'ready' | 'error'; saved: Saved; load: () => Promise<void>; retryLoad: () => Promise<void>; change: (owner: string, change: WorkspaceChange) => Promise<boolean> };

export const ownerWorkspaces = (saved: Saved, owner: string): OwnerWorkspaces => normalizeWorkspaces(saved[owner]);

export const useWorkspaceStore = create<State>((set, get) => ({
  status: 'idle',
  saved: {},
  load: async () => {
    if (get().status === 'ready' || get().status === 'loading') return;
    set({ status: 'loading' });
    let raw: string | null;
    try {
      raw = await AsyncStorage.getItem(WORKSPACES_KEY);
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
  change: (owner, change) =>
    queue(async () => {
      if (get().status !== 'ready') return false;
      const current = ownerWorkspaces(get().saved, owner);
      const next = applyWorkspaceChange(current, change);
      if (next === null) return false;
      if (next === current) return true;
      const saved = { ...get().saved, [owner]: next };
      if (Object.keys(next).length === 0) delete saved[owner];
      try {
        await AsyncStorage.setItem(WORKSPACES_KEY, JSON.stringify(saved));
      } catch {
        return false;
      }
      set({ saved });
      return true;
    }),
}));
