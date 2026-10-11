import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { MAX_PORTFOLIOS, normalizePortfolio, type Portfolio } from '@/features/culture/oymo/portfolio/portfolioModel';
import { createSerialQueue } from '@/services/storage/serialWrites';

/**
 * Oymo Design Portfolios - METADATA only (title, introduction, creation ids
 * in order, captions), on this device per owner. Designs themselves stay in
 * the account's saved creations and are never copied here.
 *
 * Writes are serialized for this key and computed from the latest state
 * inside the queue; storage first, then published. A failed write changes
 * nothing (false) so the screen keeps the edit for Retry. Load errors are an
 * error state that blocks writes.
 */
export const PORTFOLIOS_KEY = 'oyno.oymoPortfolios.v1';
type Saved = Record<string, Portfolio[]>;
const queue = createSerialQueue();

type State = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  saved: Saved;
  load: () => Promise<void>;
  retryLoad: () => Promise<void>;
  /** Creates or replaces one of this owner's portfolios. */
  save: (owner: string, portfolio: Portfolio) => Promise<boolean>;
  remove: (owner: string, id: string) => Promise<boolean>;
};

export const ownerPortfolios = (saved: Saved, owner: string): Portfolio[] => (Array.isArray(saved[owner]) ? saved[owner].flatMap((raw) => normalizePortfolio(raw) ?? []) : []);
export const ownerPortfolio = (saved: Saved, owner: string, id: string) => ownerPortfolios(saved, owner).find((portfolio) => portfolio.id === id) ?? null;

export const usePortfolioStore = create<State>((set, get) => {
  const mutate = (owner: string, change: (list: Portfolio[]) => Portfolio[] | null, unchanged: boolean) =>
    queue(async () => {
      if (get().status !== 'ready') return false;
      const current = ownerPortfolios(get().saved, owner);
      const next = change(current);
      if (next === null) return unchanged;
      try {
        await AsyncStorage.setItem(PORTFOLIOS_KEY, JSON.stringify({ ...get().saved, [owner]: next }));
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
        raw = await AsyncStorage.getItem(PORTFOLIOS_KEY);
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
    save: (owner, portfolio) =>
      mutate(owner, (list) => {
        const exists = list.some((entry) => entry.id === portfolio.id);
        if (!exists && list.length >= MAX_PORTFOLIOS) return null;
        return exists ? list.map((entry) => (entry.id === portfolio.id ? portfolio : entry)) : [portfolio, ...list];
      }, false),
    remove: (owner, id) => mutate(owner, (list) => (list.some((entry) => entry.id === id) ? list.filter((entry) => entry.id !== id) : null), true),
  };
});
