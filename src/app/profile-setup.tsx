import { router } from 'expo-router';

import { ProfileSetupScreen } from '@/features/profileSetup/ProfileSetupScreen';
import { useAppStore } from '@/store/useAppStore';
import { useAuthStore } from '@/store/useAuthStore';

export default function ProfileSetupRoute() {
  const user = useAuthStore((state) => state.user);
  const setCharacterId = useAppStore((state) => state.setCharacterId);

  return (
    <ProfileSetupScreen
      defaultName={user?.name ?? ''}
      onComplete={({ characterId }) => {
        setCharacterId(characterId);
        router.replace('/home');
      }}
    />
  );
}
