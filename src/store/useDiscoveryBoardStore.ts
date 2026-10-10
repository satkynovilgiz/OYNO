import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { MAX_BOARDS, normalizeBoard, type Board } from '@/features/culture/board/boardModel';
import { safeJsonParse } from '@/services/storage/safeJson';

/** Culture Discovery Boards: owner ('guest' or account id) -> that owner's boards. On this device only; not synced. */
export const DISCOVERY_BOARDS_KEY = 'oyno.discoveryBoards.v1';

type Saved = Record<string, Board[]>;

type State = {
  isLoaded: boolean;
  saved: Saved;
  load: () => Promise<void>;
  /** Adds (newest first) - false when the owner already has MAX_BOARDS. */
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
    saved: {},
    load: async () => {
      if (get().isLoaded) return;
      const raw = await AsyncStorage.getItem(DISCOVERY_BOARDS_KEY).catch(() => null);
      // A load that finishes late never overwrites a store already written meanwhile.
      if (get().isLoaded) return;
      const parsed = safeJsonParse<Saved>(raw, {});
      set({ saved: parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}, isLoaded: true });
    },
    add: (owner, board) => {
      const boards = ownerBoards(get().saved, owner);
      if (boards.length >= MAX_BOARDS) return false;
      put(owner, [board, ...boards]);
      return true;
    },
    update: (owner, boardId, change) => {
      const boards = ownerBoards(get().saved, owner);
      const index = boards.findIndex((board) => board.id === boardId);
      if (index === -1) return;
      const next = change(boards[index]);
      if (next === boards[index]) return;
      put(owner, boards.map((board, position) => (position === index ? next : board)));
    },
    remove: (owner, boardId) => {
      const boards = ownerBoards(get().saved, owner);
      if (!boards.some((board) => board.id === boardId)) return;
      put(owner, boards.filter((board) => board.id !== boardId));
    },
  };
});
