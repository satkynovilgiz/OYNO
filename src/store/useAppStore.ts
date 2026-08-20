import { create } from 'zustand';

import i18n, { DEFAULT_LANGUAGE, type SupportedLanguage } from '@/i18n';
import type { CharacterId } from '@/components/character';

type AppState = {
  language: SupportedLanguage;
  setLanguage: (language: SupportedLanguage) => void;
  /** The user's chosen avatar character (Task 3, Каарманыңды танда).
   * Local-only for now - there's no auth/backend layer in this codebase
   * yet, so "persist for registered accounts" isn't wired up. Once one
   * exists, setCharacterId is the place to add that sync call. */
  characterId: CharacterId | null;
  setCharacterId: (characterId: CharacterId) => void;
};

export const useAppStore = create<AppState>((set) => ({
  language: (i18n.language as SupportedLanguage) || DEFAULT_LANGUAGE,
  setLanguage: (language) => {
    i18n.changeLanguage(language);
    set({ language });
  },
  characterId: null,
  setCharacterId: (characterId) => set({ characterId }),
}));

// i18next resolves the persisted/device language asynchronously after init,
// so keep the store in sync once detection completes.
i18n.on('languageChanged', (language) => {
  useAppStore.setState({ language: language as SupportedLanguage });
});
