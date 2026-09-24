import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { safeJsonParse } from '@/services/storage/safeJson';
import { recordFavoriteOp } from '@/services/sync/outbox';
import { currentEditOrigin, requestAccountSync } from '@/services/sync/syncTrigger';

const STORAGE_KEY = 'oyno.wallpapers.favorites';

/** The key a wallpaper favorite uses in the shared favorites table. */
export const WALLPAPER_FAVORITE_PREFIX = 'wallpaper:';

/**
 * Wallpaper favorites. Kept as their own small list (the main Favorites
 * screen is for saved content, not wallpapers), but for a signed-in user
 * they sync through the SAME `user_favorites` table as every other
 * favorite (target_type 'wallpaper') - not a second favorites system.
 */
export function toggleWallpaperId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((entry) => entry !== id) : [...ids, id];
}

type WallpaperFavoritesState = {
  ids: string[];
  isLoaded: boolean;
  load: () => Promise<void>;
  toggle: (id: string) => Promise<void>;
  /** Sync layer only: the merged account wallpaper favorites. */
  applySynced: (ids: string[]) => void;
  /** Sign-out: forget the previous account's list on this device. */
  reset: () => void;
};

export const useWallpaperFavoritesStore = create<WallpaperFavoritesState>((set, get) => ({
  ids: [],
  isLoaded: false,
  load: async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
    const parsed = safeJsonParse<unknown>(raw, []);
    set({ ids: Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [], isLoaded: true });
  },
  toggle: async (id) => {
    const ids = toggleWallpaperId(get().ids, id);
    set({ ids });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ids)).catch(() => {});
    const origin = currentEditOrigin();
    await recordFavoriteOp(`${WALLPAPER_FAVORITE_PREFIX}${id}`, { favorited: ids.includes(id), at: new Date().toISOString(), origin });
    if (origin === 'account') requestAccountSync('local_change');
  },
  applySynced: (ids) => {
    set({ ids, isLoaded: true });
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ids)).catch(() => {});
  },
  reset: () => set({ ids: [], isLoaded: true }),
}));
