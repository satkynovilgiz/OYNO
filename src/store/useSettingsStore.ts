import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

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

async function persist(state: PersistedShape) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  notifications: DEFAULT_NOTIFICATION_PREFERENCES,
  privacy: DEFAULT_PRIVACY_PREFERENCES,
  game: DEFAULT_GAME_PREFERENCES,
  isLoaded: false,

  load: async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      set({
        notifications: { ...DEFAULT_NOTIFICATION_PREFERENCES, ...parsed.notifications },
        privacy: { ...DEFAULT_PRIVACY_PREFERENCES, ...parsed.privacy },
        game: { ...DEFAULT_GAME_PREFERENCES, ...parsed.game },
        isLoaded: true,
      });
    } else {
      set({ isLoaded: true });
    }
  },

  setNotificationPreference: (id, value) => {
    const notifications = { ...get().notifications, [id]: value };
    set({ notifications });
    void persist({ notifications, privacy: get().privacy, game: get().game });
  },

  setPrivacyPreference: (key, value) => {
    const privacy = { ...get().privacy, [key]: value };
    set({ privacy });
    void persist({ notifications: get().notifications, privacy, game: get().game });
  },

  setGamePreference: (key, value) => {
    const game = { ...get().game, [key]: value };
    set({ game });
    void persist({ notifications: get().notifications, privacy: get().privacy, game });
  },
}));
