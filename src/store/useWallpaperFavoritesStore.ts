import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { safeJsonParse } from '@/services/storage/safeJson';

const STORAGE_KEY = 'oyno.wallpapers.favorites';

/**
 * Wallpaper favorites, persisted on the device. Deliberately separate from
 * the app's main Favorites (useFavoritesStore): that one syncs to a
 * server table whose allowed content types don't include wallpapers, and
 * wallpapers are a personal-appearance preference, not saved content -
 * so this stays a tiny local list and never touches existing favorites.
 */
export function toggleWallpaperId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((entry) => entry !== id) : [...ids, id];
}

type WallpaperFavoritesState = {
  ids: string[];
  isLoaded: boolean;
  load: () => Promise<void>;
  toggle: (id: string) => Promise<void>;
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
  },
}));
