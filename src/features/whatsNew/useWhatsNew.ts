import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo } from 'react';
import { create } from 'zustand';

import { useAllCultureItems } from '@/services/content/cultureItemsService';
import { useCultureMaterials } from '@/services/content/cultureService';

import { unseenItems, whatsNewItems, type WhatsNewItem } from './whatsNew';

const KEY = 'oyno.whatsNew.lastViewedAt';

/** Device-level "seen" state for What's New. */
export const useWhatsNewSeen = create<{ isLoaded: boolean; lastViewedAt: string | null; load: () => Promise<void>; markViewed: () => void }>((set, get) => ({
  isLoaded: false,
  lastViewedAt: null,
  load: async () => {
    if (get().isLoaded) return;
    const value = await AsyncStorage.getItem(KEY).catch(() => null);
    set({ lastViewedAt: value && !Number.isNaN(Date.parse(value)) ? value : null, isLoaded: true });
  },
  markViewed: () => {
    const now = new Date().toISOString();
    set({ lastViewedAt: now });
    void AsyncStorage.setItem(KEY, now).catch(() => undefined);
  },
}));

/** Built from the content lists the app already loads (offline: cached/downloaded data). */
export function useWhatsNew(): { items: WhatsNewItem[]; unseen: WhatsNewItem[]; isLoaded: boolean } {
  const { data: items } = useAllCultureItems();
  const { data: materials } = useCultureMaterials();
  const lastViewedAt = useWhatsNewSeen((state) => state.lastViewedAt);
  const isLoaded = useWhatsNewSeen((state) => state.isLoaded);
  useEffect(() => {
    void useWhatsNewSeen.getState().load();
  }, []);
  const list = useMemo(
    () =>
      whatsNewItems(
        [...(items ?? []).map((row) => ({ type: 'culture_item' as const, ...row })), ...(materials ?? []).map((row) => ({ type: 'culture_material' as const, ...row }))],
        new Date(),
      ),
    [items, materials],
  );
  return { items: list, unseen: isLoaded ? unseenItems(list, lastViewedAt) : [], isLoaded };
}
