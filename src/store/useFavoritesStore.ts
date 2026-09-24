import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { safeJsonParse } from '@/services/storage/safeJson';
import { recordFavoriteOp } from '@/services/sync/outbox';
import { requestAccountSync } from '@/services/sync/syncTrigger';
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

export const FAVORITES_CACHE_KEY = CACHE_KEY;

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
  /** Returns the new favorited state (true = now favorited). Instant and
   * local for everyone (guests included); the edit is recorded in the
   * sync outbox and a signed-in account is updated in the background by
   * the sync layer - offline edits wait there and are sent on reconnect. */
  toggleFavorite: (contentType: FavoriteContentType, contentId: string) => Promise<boolean>;
  favoriteRefs: () => FavoriteRef[];
  /** Sync layer only: the merged account favorites (wallpapers excluded). */
  applySynced: (favoriteIds: string[]) => void;
  /** Sign-out: forget the previous account's favorites on this device. */
  reset: () => void;
};

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  isLoaded: false,
  favoriteIds: [],

  // Local first: the device's last-known favorites render immediately
  // (also offline); the sync layer reconciles a signed-in account with the
  // server afterwards (services/sync/syncEngine.ts).
  load: async () => {
    const cached = await readCache();
    set({ favoriteIds: cached?.favoriteIds ?? [], isLoaded: true });
    if (isRealUser()) requestAccountSync('app_start');
  },

  isFavorite: (contentType, contentId) => get().favoriteIds.includes(favoriteKey(contentType, contentId)),

  toggleFavorite: async (contentType, contentId) => {
    const key = favoriteKey(contentType, contentId);
    const current = get().favoriteIds;
    const willFavorite = !current.includes(key);
    const nextFavoriteIds = willFavorite ? [...current, key] : current.filter((id) => id !== key);

    set({ favoriteIds: nextFavoriteIds });
    void writeCache({ favoriteIds: nextFavoriteIds });
    await recordFavoriteOp(key, { favorited: willFavorite, at: new Date().toISOString(), origin: isRealUser() ? 'account' : 'guest' });
    if (isRealUser()) requestAccountSync('local_change');
    return willFavorite;
  },

  favoriteRefs: () => get().favoriteIds.map(parseFavoriteKey),

  applySynced: (favoriteIds) => {
    set({ favoriteIds, isLoaded: true });
    void writeCache({ favoriteIds });
  },

  reset: () => set({ favoriteIds: [], isLoaded: true }),
}));
