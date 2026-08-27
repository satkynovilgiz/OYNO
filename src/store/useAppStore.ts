import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import i18n, { DEFAULT_LANGUAGE, type SupportedLanguage } from '@/i18n';
import { ALL_CHARACTER_IDS, type CharacterId } from '@/components/character';
import { track } from '@/services/analytics/analytics';
import { supabase } from '@/services/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';

const ONBOARDING_COMPLETE_KEY = 'oyno.onboardingComplete';
const LANGUAGE_CHOSEN_KEY = 'oyno.languageChosen';
const CHARACTER_ID_KEY = 'oyno.characterId';

type AppState = {
  language: SupportedLanguage;
  setLanguage: (language: SupportedLanguage) => void;
  characterId: CharacterId | null;
  isCharacterLoaded: boolean;
  /** Sets the selected character and persists it - to AsyncStorage always
   * (so it survives close/reopen for guests too, which it never did
   * before), and to the profiles.character_id column when signed in (so it
   * follows the account across devices/reinstalls), same cache+server
   * pattern as useSettingsStore. */
  setCharacterId: (characterId: CharacterId) => void;
  /** Loads the persisted character - server value takes priority when
   * signed in (source of truth across devices), falling back to the local
   * cache for guests or if the fetch fails. Call once per authStatus
   * change, same pattern as useProgressStore/useSettingsStore's load(). */
  loadCharacterId: () => Promise<void>;

  /** Whether the first-launch language picker (spec Section 14, distinct
   * from the Settings language switcher) has already been shown once. */
  hasChosenLanguage: boolean;
  /** Whether the onboarding slides (spec Section 12) have been completed.
   * Persisted so returning users skip straight past them. */
  hasCompletedOnboarding: boolean;
  /** Loads the two persisted flags above. Call once from Splash before
   * deciding where to route. */
  loadOnboardingFlags: () => Promise<void>;
  markLanguageChosen: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
};

function isRealUser(): boolean {
  return useAuthStore.getState().status === 'authenticated';
}

async function persistCharacterCache(characterId: CharacterId) {
  await AsyncStorage.setItem(CHARACTER_ID_KEY, characterId).catch(() => {});
}

async function persistCharacterServer(characterId: CharacterId) {
  if (!isRealUser()) return;
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return;
  const { error } = await supabase.from('profiles').update({ character_id: characterId }).eq('id', userId);
  if (error && __DEV__) console.warn('[app] failed to sync characterId to server', error.message);
}

export const useAppStore = create<AppState>((set) => ({
  language: (i18n.language as SupportedLanguage) || DEFAULT_LANGUAGE,
  setLanguage: (language) => {
    i18n.changeLanguage(language);
    set({ language });
  },
  characterId: null,
  isCharacterLoaded: false,

  setCharacterId: (characterId) => {
    set({ characterId });
    void persistCharacterCache(characterId);
    void persistCharacterServer(characterId);
  },

  loadCharacterId: async () => {
    const cachedRaw = await AsyncStorage.getItem(CHARACTER_ID_KEY).catch(() => null);
    const cached = (ALL_CHARACTER_IDS as string[]).includes(cachedRaw ?? '') ? (cachedRaw as CharacterId) : null;

    if (isRealUser()) {
      const userId = useAuthStore.getState().user?.id;
      const { data, error } = await supabase.from('profiles').select('character_id').eq('id', userId).maybeSingle();
      if (!error && data?.character_id) {
        const characterId = data.character_id as CharacterId;
        set({ characterId, isCharacterLoaded: true });
        void persistCharacterCache(characterId);
        return;
      }
    }

    set({ characterId: cached, isCharacterLoaded: true });
  },

  hasChosenLanguage: false,
  hasCompletedOnboarding: false,

  loadOnboardingFlags: async () => {
    const [languageChosen, onboardingComplete] = await Promise.all([
      AsyncStorage.getItem(LANGUAGE_CHOSEN_KEY).catch(() => null),
      AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY).catch(() => null),
    ]);
    set({
      hasChosenLanguage: languageChosen === 'true',
      hasCompletedOnboarding: onboardingComplete === 'true',
    });
  },

  markLanguageChosen: async () => {
    await AsyncStorage.setItem(LANGUAGE_CHOSEN_KEY, 'true');
    set({ hasChosenLanguage: true });
  },

  completeOnboarding: async () => {
    await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
    set({ hasCompletedOnboarding: true });
    track('onboarding_completed');
  },
}));

// i18next resolves the persisted/device language asynchronously after init,
// so keep the store in sync once detection completes.
i18n.on('languageChanged', (language) => {
  useAppStore.setState({ language: language as SupportedLanguage });
});
