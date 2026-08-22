import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import i18n, { DEFAULT_LANGUAGE, type SupportedLanguage } from '@/i18n';
import type { CharacterId } from '@/components/character';
import { track } from '@/services/analytics/analytics';

const ONBOARDING_COMPLETE_KEY = 'oyno.onboardingComplete';
const LANGUAGE_CHOSEN_KEY = 'oyno.languageChosen';

type AppState = {
  language: SupportedLanguage;
  setLanguage: (language: SupportedLanguage) => void;
  characterId: CharacterId | null;
  setCharacterId: (characterId: CharacterId) => void;

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

export const useAppStore = create<AppState>((set) => ({
  language: (i18n.language as SupportedLanguage) || DEFAULT_LANGUAGE,
  setLanguage: (language) => {
    i18n.changeLanguage(language);
    set({ language });
  },
  characterId: null,
  setCharacterId: (characterId) => set({ characterId }),

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
