import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import i18n, { type LanguageDetectorAsyncModule } from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import kg from './locales/kg.json';
import ru from './locales/ru.json';

export const SUPPORTED_LANGUAGES = ['kg', 'ru', 'en'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: SupportedLanguage = 'kg';

const LANGUAGE_STORAGE_KEY = 'oyno.language';

function isSupportedLanguage(value: string | null | undefined): value is SupportedLanguage {
  return !!value && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

const languageDetector: LanguageDetectorAsyncModule = {
  type: 'languageDetector',
  async: true,
  detect: async (callback) => {
    const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isSupportedLanguage(stored)) {
      callback(stored);
      return;
    }

    const deviceLanguage = Localization.getLocales()[0]?.languageCode;
    callback(isSupportedLanguage(deviceLanguage) ? deviceLanguage : DEFAULT_LANGUAGE);
  },
  init: () => {},
  cacheUserLanguage: async (language) => {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  },
};

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      kg: { translation: kg },
      ru: { translation: ru },
      en: { translation: en },
    },
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });

export default i18n;
