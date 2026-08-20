import { router } from 'expo-router';

import { CharacterSelectScreen } from '@/features/characterSelect/CharacterSelectScreen';
import { useAppStore } from '@/store/useAppStore';

export default function CharacterSelectRoute() {
  const characterId = useAppStore((state) => state.characterId);
  const setCharacterId = useAppStore((state) => state.setCharacterId);

  return (
    <CharacterSelectScreen
      isGuest
      initialCharacterId={characterId}
      onConfirm={(id) => {
        setCharacterId(id);
        router.back();
      }}
    />
  );
}
