import { router } from 'expo-router';

import { LanguageSelectScreen } from '@/features/language/LanguageSelectScreen';
import { useAppStore } from '@/store/useAppStore';

export default function LanguageRoute() {
  const language = useAppStore((state) => state.language);
  const setLanguage = useAppStore((state) => state.setLanguage);
  const markLanguageChosen = useAppStore((state) => state.markLanguageChosen);

  return (
    <LanguageSelectScreen
      selected={language}
      onSelect={setLanguage}
      onContinue={async () => {
        await markLanguageChosen();
        router.replace('/onboarding');
      }}
    />
  );
}
