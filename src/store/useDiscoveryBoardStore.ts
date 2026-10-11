import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { MAX_BOARDS, normalizeBoard, type Board } from '@/features/culture/board/boardModel';

/** Culture Discovery Boards: owner ('guest' or account id) -> that owner's boards. On this device only; not synced. */
export const DISCOVERY_BOARDS_KEY = 'oyno.discoveryBoards.v1';

type Saved = Record<string, Board[]>;

export type BoardLoadStatus = 'idle' | 'loading' | 'ready' | 'error';
type State = {
  isLoaded: boolean;
  /** 'error': the stored boards couldn't be read - they stay on the device untouched and no write is allowed. */
  status: BoardLoadStatus;
  saved: Saved;
  load: () => Promise<void>;
  /** After a failed read. */
  retryLoad: () => Promise<void>;
  /** Adds (newest first) - false before storage has loaded (or after a failed read), or at MAX_BOARDS. */
  add: (owner: string, board: Board) => boolean;
  /** Replaces one of THIS owner's boards (by id); a board of another owner can't be reached. */
  update: (owner: string, boardId: string, change: (board: Board) => Board) => void;
  remove: (owner: string, boardId: string) => void;
};

/** The owner's boards, re-checked on every read. Another owner's boards are never returned. */
export function ownerBoards(saved: Saved, owner: string): Board[] {
  const list = saved[owner];
  return Array.isArray(list) ? list.flatMap((raw) => normalizeBoard(raw) ?? []) : [];
}
export function ownerBoard(saved: Saved, owner: string, boardId: string): Board | null {
  return ownerBoards(saved, owner).find((board) => board.id === boardId) ?? null;
}

export const useDiscoveryBoardStore = create<State>((set, get) => {
  const persist = () => void AsyncStorage.setItem(DISCOVERY_BOARDS_KEY, JSON.stringify(get().saved)).catch(() => undefined);
  const put = (owner: string, boards: Board[]) => {
    set({ saved: { ...get().saved, [owner]: boards } });
    persist();
  };
  return {
    isLoaded: false,
    status: 'idle',
    saved: {},
    load: async () => {
      if (get().status === 'ready' || get().status === 'loading') return;
      set({ status: 'loading' });
      let raw: string | null;
      try {
        raw = await AsyncStorage.getItem(DISCOVERY_BOARDS_KEY);
      } catch {
        set({ status: 'error' });
        return;
      }
      // A load that finishes late never overwrites a store already written meanwhile.
      if (get().isLoaded) return;
      let parsed: unknown = {};
      if (raw !== null) {
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = null;
        }
      }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        // Unreadable: kept as it is on the device; nothing may be written over it.
        set({ status: 'error' });
        return;
      }
      set({ saved: parsed as Saved, isLoaded: true, status: 'ready' });
    },
    retryLoad: async () => {
      if (get().status !== 'error') return;
      set({ status: 'idle' });
      await get().load();
    },
    add: (owner, board) => {
      // Before the stored boards are known, a write would replace them.
      if (get().status !== 'ready') return false;
      const boards = ownerBoards(get().saved, owner);
      if (boards.length >= MAX_BOARDS) return false;
      put(owner, [board, ...boards]);
      return true;
    },
    update: (owner, boardId, change) => {
      if (get().status !== 'ready') return;
      const boards = ownerBoards(get().saved, owner);
      const index = boards.findIndex((board) => board.id === boardId);
      if (index === -1) return;
      const next = change(boards[index]);
      if (next === boards[index]) return;
      put(owner, boards.map((board, position) => (position === index ? next : board)));
    },
    remove: (owner, boardId) => {
      if (get().status !== 'ready') return;
      const boards = ownerBoards(get().saved, owner);
      if (!boards.some((board) => board.id === boardId)) return;
      put(owner, boards.filter((board) => board.id !== boardId));
    },
  };
});
