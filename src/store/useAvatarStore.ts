import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import { create } from 'zustand';

import { sanitizeAvatarConfig } from '@/services/avatar/avatarCatalog';
import type { AvatarConfig } from '@/services/avatar/avatarConfig';
import { createDefaultAvatarConfig } from '@/services/avatar/defaultAvatar';
import { safeJsonParse } from '@/services/storage/safeJson';
import { supabase } from '@/services/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';

const CACHE_KEY = 'oyno.avatar.cache';

type CachedShape = {
  config: AvatarConfig;
  hasEverSaved: boolean;
  /** True if this cached config was written by save() but the server
   * write never confirmed (offline, or a request failure) - load() must
   * never let a clean server fetch clobber a dirty cache, and must retry
   * pushing it instead. This flag *is* the offline retry queue; no
   * separate persisted queue exists. */
  dirty: boolean;
};

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

type AvatarState = {
  config: AvatarConfig;
  /** False until the user has explicitly saved at least once (including a
   * guest save) - UserAvatar uses this to keep rendering the familiar
   * CharacterAvatar portrait for every account that hasn't opted into
   * customization yet, avoiding any visual regression. */
  hasEverSaved: boolean;
  isLoaded: boolean;
  isSaving: boolean;
  /** True while a save's server write hasn't succeeded yet (mirrors the
   * cache's own `dirty` flag). */
  isDirty: boolean;
  lastSyncError: string | null;
  load: () => Promise<void>;
  save: (config: AvatarConfig) => Promise<boolean>;
  retrySync: () => Promise<void>;
};

let networkRetrySubscription: { remove: () => void } | null = null;

function armRetryOnReconnect() {
  networkRetrySubscription?.remove();
  networkRetrySubscription = Network.addNetworkStateListener((state) => {
    if (state.isConnected) {
      networkRetrySubscription?.remove();
      networkRetrySubscription = null;
      void useAvatarStore.getState().retrySync();
    }
  });
}

async function pushToServer(config: AvatarConfig): Promise<{ error: string | null }> {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return { error: 'not authenticated' };
  const { error } = await supabase.from('user_avatars').update({ config }).eq('user_id', userId);
  return { error: error?.message ?? null };
}

export const useAvatarStore = create<AvatarState>((set, get) => ({
  config: createDefaultAvatarConfig(),
  hasEverSaved: false,
  isLoaded: false,
  isSaving: false,
  isDirty: false,
  lastSyncError: null,

  load: async () => {
    const cached = await readCache();

    if (!isRealUser()) {
      set({
        config: cached ? sanitizeAvatarConfig(cached.config) : createDefaultAvatarConfig(),
        hasEverSaved: cached?.hasEverSaved ?? false,
        isDirty: false,
        isLoaded: true,
        lastSyncError: null,
      });
      return;
    }

    if (cached?.dirty) {
      // A previous save never reached the server - the local edit wins,
      // never let a clean fetch below silently overwrite it. Retry the
      // push now instead.
      set({
        config: sanitizeAvatarConfig(cached.config),
        hasEverSaved: cached.hasEverSaved,
        isDirty: true,
        isLoaded: true,
        lastSyncError: null,
      });
      void get().retrySync();
      return;
    }

    const { data, error } = await supabase.from('user_avatars').select('config').single();
    if (!error && data) {
      const config = sanitizeAvatarConfig(data.config as Partial<AvatarConfig>);
      const hasEverSaved = cached?.hasEverSaved ?? false;
      set({ config, hasEverSaved, isDirty: false, isLoaded: true, lastSyncError: null });
      void writeCache({ config, hasEverSaved, dirty: false });
      return;
    }

    // Offline or a genuine failure - fall back to cache (same pattern as
    // useProgressStore.load()'s own offline fallback).
    set({
      config: cached ? sanitizeAvatarConfig(cached.config) : createDefaultAvatarConfig(),
      hasEverSaved: cached?.hasEverSaved ?? false,
      isDirty: cached?.dirty ?? false,
      isLoaded: true,
      lastSyncError: 'offline',
    });
  },

  save: async (config) => {
    const sanitized = sanitizeAvatarConfig(config);
    set({ isSaving: true });

    // Write-ahead to cache first, marked dirty, so a crash mid-save can
    // never lose the edit - it's recoverable from the cache on next load()
    // even if the app never gets to finish this function.
    await writeCache({ config: sanitized, hasEverSaved: true, dirty: true });
    set({ config: sanitized, isDirty: true });

    if (!isRealUser()) {
      // Guests have nothing to sync to - the cache write above is the
      // only persistence they get, same rule every other store follows.
      set({ isSaving: false, isDirty: false, hasEverSaved: true, lastSyncError: null });
      await writeCache({ config: sanitized, hasEverSaved: true, dirty: false });
      return true;
    }

    const { error } = await pushToServer(sanitized);
    if (error) {
      set({ isSaving: false, isDirty: true, lastSyncError: error });
      armRetryOnReconnect();
      return false;
    }

    set({ isSaving: false, isDirty: false, hasEverSaved: true, lastSyncError: null });
    await writeCache({ config: sanitized, hasEverSaved: true, dirty: false });
    return true;
  },

  retrySync: async () => {
    if (!isRealUser() || !get().isDirty) return;
    const { error } = await pushToServer(get().config);
    if (error) {
      set({ lastSyncError: error });
      armRetryOnReconnect();
      return;
    }
    set({ isDirty: false, lastSyncError: null });
    await writeCache({ config: get().config, hasEverSaved: true, dirty: false });
  },
}));
