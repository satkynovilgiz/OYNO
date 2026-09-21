import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { safeJsonParse } from '@/services/storage/safeJson';
import { supabase } from '@/services/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';

const CACHE_KEY = 'oyno.favorites.cache';

/**
 * The one favorite/saved-content type for the whole app (spec "Turn OYNO
 * Favorites into a real cross-app saved collection... Do not let Games,
 * Culture and Explore maintain incompatible favorite systems"). Backed by
 * the same `user_favorites` table/`toggle_favorite` RPC that already
 * existed for Explore's region/nature favoriting
 * (20260901000002_explore_v2.sql) - generalized by
 * 20260920000001_favorites_all_content_types.sql rather than replaced, so
 * existing users' region/nature favorites carry over unchanged instead of
 * being migrated into a duplicate system.
 */
export type FavoriteContentType = 'region' | 'nature' | 'game' | 'culture_material' | 'culture_item' | 'interactive_experience';

export type FavoriteRef = { contentType: FavoriteContentType; contentId: string };

export function favoriteKey(contentType: FavoriteContentType, contentId: string): string {
  return `${contentType}:${contentId}`;
}

function parseFavoriteKey(key: string): FavoriteRef {
  const separatorIndex = key.indexOf(':');
  return { contentType: key.slice(0, separatorIndex) as FavoriteContentType, contentId: key.slice(separatorIndex + 1) };
}

type CachedShape = { favoriteIds: string[] };

function isRealUser(): boolean {
  return useAuthStore.getState().status === 'authenticated';
}

async function readCache(): Promise<CachedShape | null> {
  const raw = await AsyncStorage.getItem(CACHE_KEY).catch(() => null);
  return safeJsonParse<CachedShape | null>(raw, null);
}

async function writeCache(state: CachedShape) {
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(state)).catch(() => {});
}

type FavoritesState = {
  isLoaded: boolean;
  favoriteIds: string[];
  load: () => Promise<void>;
  isFavorite: (contentType: FavoriteContentType, contentId: string) => boolean;
  /** Returns the new favorited state (true = now favorited). Guests get a
   * real, working, locally-persisted toggle here - unlike the old
   * Explore-only mechanism this replaces, which silently no-op'd
   * (`return null`) for anyone not signed in. Signed-in sync happens in
   * the background; a transient failure keeps the optimistic local change
   * rather than snapping the heart back, and self-heals on the next
   * successful `load()`. */
  toggleFavorite: (contentType: FavoriteContentType, contentId: string) => Promise<boolean>;
  favoriteRefs: () => FavoriteRef[];
};

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  isLoaded: false,
  favoriteIds: [],

  load: async () => {
    const cached = await readCache();

    if (!isRealUser()) {
      set({ favoriteIds: cached?.favoriteIds ?? [], isLoaded: true });
      return;
    }

    const { data, error } = await supabase.from('user_favorites').select('target_type, target_id');
    if (!error && data) {
      const favoriteIds = data.map((row) => favoriteKey(row.target_type as FavoriteContentType, row.target_id as string));
      set({ favoriteIds, isLoaded: true });
      void writeCache({ favoriteIds });
      return;
    }

    // Offline or a genuine failure - fall back to cache (same pattern as
    // useProgressStore.load()'s own offline fallback), so a real device
    // trying this while unreachable still sees its last-known favorites
    // instead of an empty list.
    set({ favoriteIds: cached?.favoriteIds ?? [], isLoaded: true });
  },

  isFavorite: (contentType, contentId) => get().favoriteIds.includes(favoriteKey(contentType, contentId)),

  toggleFavorite: async (contentType, contentId) => {
    const key = favoriteKey(contentType, contentId);
    const current = get().favoriteIds;
    const willFavorite = !current.includes(key);
    const nextFavoriteIds = willFavorite ? [...current, key] : current.filter((id) => id !== key);

    // Optimistic local update first, for guests and signed-in users alike
    // - a heart should respond instantly, and guests need this to be the
    // only persistence they get (same rule useAvatarStore.save() follows
    // for its own guest path).
    set({ favoriteIds: nextFavoriteIds });
    void writeCache({ favoriteIds: nextFavoriteIds });

    if (!isRealUser()) return willFavorite;

    const { error } = await supabase.rpc('toggle_favorite', { p_target_type: contentType, p_target_id: contentId });
    if (error && __DEV__) {
      console.warn('[favorites] server sync failed, keeping local toggle:', error.message);
    }
    return willFavorite;
  },

  favoriteRefs: () => get().favoriteIds.map(parseFavoriteKey),
}));
