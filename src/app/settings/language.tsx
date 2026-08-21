import { router } from 'expo-router';

import { SettingsLanguageScreen } from '@/features/settings/SettingsLanguageScreen';
import { useAppStore } from '@/store/useAppStore';

export default function SettingsLanguageRoute() {
  const language = useAppStore((state) => state.language);
  const setLanguage = useAppStore((state) => state.setLanguage);

  return <SettingsLanguageScreen selected={language} onSelect={setLanguage} onPressBack={() => router.back()} />;
}
