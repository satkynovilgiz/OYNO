import { router } from 'expo-router';

import { GameSettingsScreen } from '@/features/settings/GameSettingsScreen';
import { useSettingsStore } from '@/store/useSettingsStore';

export default function GameSettingsRoute() {
  const preferences = useSettingsStore((state) => state.game);
  const setGamePreference = useSettingsStore((state) => state.setGamePreference);

  return <GameSettingsScreen preferences={preferences} onChange={setGamePreference} onPressBack={() => router.back()} />;
}
