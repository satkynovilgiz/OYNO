import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { safeJsonParse } from '@/services/storage/safeJson';
import { supabase } from '@/services/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';

const STORAGE_KEY = 'oyno.settings';

export type NotificationPreferenceId =
  | 'dailyChallenge'
  | 'rewards'
  | 'achievements'
  | 'friendRequests'
  | 'gameInvitations'
  | 'events'
  | 'news';

export type ProfileVisibility = 'public' | 'friends' | 'private';
export type LeaderboardVisibility = 'visible' | 'hidden';
export type ActivityVisibility = 'public' | 'friends' | 'private';

export type NotificationPreferences = Record<NotificationPreferenceId, boolean>;

export type PrivacyPreferences = {
  profileVisibility: ProfileVisibility;
  leaderboardVisibility: LeaderboardVisibility;
  activityVisibility: ActivityVisibility;
};

export type GamePreferences = {
  soundEffects: boolean;
  music: boolean;
  haptics: boolean;
};

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  dailyChallenge: true,
  rewards: true,
  achievements: true,
  friendRequests: true,
  gameInvitations: true,
  events: true,
  news: false,
};

const DEFAULT_PRIVACY_PREFERENCES: PrivacyPreferences = {
  profileVisibility: 'public',
  leaderboardVisibility: 'visible',
  activityVisibility: 'friends',
};

const DEFAULT_GAME_PREFERENCES: GamePreferences = {
  soundEffects: true,
  music: true,
  haptics: true,
};

type PersistedShape = {
  notifications: NotificationPreferences;
  privacy: PrivacyPreferences;
  game: GamePreferences;
};

type SettingsState = PersistedShape & {
  isLoaded: boolean;
  load: () => Promise<void>;
  setNotificationPreference: (id: NotificationPreferenceId, value: boolean) => void;
  setPrivacyPreference: <K extends keyof PrivacyPreferences>(key: K, value: PrivacyPreferences[K]) => void;
  setGamePreference: <K extends keyof GamePreferences>(key: K, value: GamePreferences[K]) => void;
};

function isRealUser(): boolean {
  return useAuthStore.getState().status === 'authenticated';
}

async function persistCache(state: PersistedShape) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
}

/** Real per-account storage (supabase/migrations/20260825000001_settings_and_analytics.sql)
 * so preferences follow the user across devices/reinstalls instead of
 * living only in this device's AsyncStorage. AsyncStorage stays as an
 * offline-read cache and the fallback for guests, same pattern as
 * useProgressStore's cache. */
async function persistServer(state: PersistedShape) {
  if (!isRealUser()) return;
  await supabase
    .from('user_settings')
    .update({ notifications: state.notifications, privacy: state.privacy, game: state.game })
    .eq('user_id', useAuthStore.getState().user?.id)
    .then(({ error }) => {
      if (error && __DEV__) console.warn('[settings] failed to sync to server', error.message);
    });
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  notifications: DEFAULT_NOTIFICATION_PREFERENCES,
  privacy: DEFAULT_PRIVACY_PREFERENCES,
  game: DEFAULT_GAME_PREFERENCES,
  isLoaded: false,

  load: async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
    const cached = safeJsonParse<Partial<PersistedShape>>(raw, {});

    if (isRealUser()) {
      const { data, error } = await supabase
        .from('user_settings')
        .select('notifications, privacy, game')
        .single();
      if (!error && data) {
        const fields: PersistedShape = {
          notifications: { ...DEFAULT_NOTIFICATION_PREFERENCES, ...(data.notifications as Partial<NotificationPreferences>) },
          privacy: { ...DEFAULT_PRIVACY_PREFERENCES, ...(data.privacy as Partial<PrivacyPreferences>) },
          game: { ...DEFAULT_GAME_PREFERENCES, ...(data.game as Partial<GamePreferences>) },
        };
        set({ ...fields, isLoaded: true });
        void persistCache(fields);
        return;
      }
    }

    set({
      notifications: { ...DEFAULT_NOTIFICATION_PREFERENCES, ...cached.notifications },
      privacy: { ...DEFAULT_PRIVACY_PREFERENCES, ...cached.privacy },
      game: { ...DEFAULT_GAME_PREFERENCES, ...cached.game },
      isLoaded: true,
    });
  },

  setNotificationPreference: (id, value) => {
    const notifications = { ...get().notifications, [id]: value };
    set({ notifications });
    const next = { notifications, privacy: get().privacy, game: get().game };
    void persistCache(next);
    void persistServer(next);
  },

  setPrivacyPreference: (key, value) => {
    const privacy = { ...get().privacy, [key]: value };
    set({ privacy });
    const next = { notifications: get().notifications, privacy, game: get().game };
    void persistCache(next);
    void persistServer(next);
  },

  setGamePreference: (key, value) => {
    const game = { ...get().game, [key]: value };
    set({ game });
    const next = { notifications: get().notifications, privacy: get().privacy, game };
    void persistCache(next);
    void persistServer(next);
  },
}));
