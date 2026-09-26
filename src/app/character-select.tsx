import { router } from 'expo-router';

import { CharacterSelectScreen } from '@/features/characterSelect/CharacterSelectScreen';
import { useAppStore } from '@/store/useAppStore';
import { useAuthStore } from '@/store/useAuthStore';

/** Settings > Story Companion: changes the guide only - never the avatar,
 * progress or age group. */
export default function CharacterSelectRoute() {
  const characterId = useAppStore((state) => state.characterId);
  const setCharacterId = useAppStore((state) => state.setCharacterId);
  // Was hardcoded to guest, so signed-in users were told to "create an account".
  const isGuest = useAuthStore((state) => state.status !== 'authenticated');
  const back = () => (router.canGoBack() ? router.back() : router.replace('/home'));

  return (
    <CharacterSelectScreen
      context="change"
      isGuest={isGuest}
      initialCharacterId={characterId}
      onBack={back}
      onConfirm={(id) => {
        setCharacterId(id);
        back();
      }}
    />
  );
}
