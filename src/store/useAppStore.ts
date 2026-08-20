import { create } from 'zustand';

import i18n, { DEFAULT_LANGUAGE, type SupportedLanguage } from '@/i18n';

type AppState = {
  language: SupportedLanguage;
  setLanguage: (language: SupportedLanguage) => void;
};

export const useAppStore = create<AppState>((set) => ({
  language: (i18n.language as SupportedLanguage) || DEFAULT_LANGUAGE,
  setLanguage: (language) => {
    i18n.changeLanguage(language);
    set({ language });
  },
}));

// i18next resolves the persisted/device language asynchronously after init,
// so keep the store in sync once detection completes.
i18n.on('languageChanged', (language) => {
  useAppStore.setState({ language: language as SupportedLanguage });
});
