import { router } from 'expo-router';

import { ProfileSetupScreen } from '@/features/profileSetup/ProfileSetupScreen';
import { useAppStore } from '@/store/useAppStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useAvatarStore } from '@/store/useAvatarStore';

export default function ProfileSetupRoute() {
  const user = useAuthStore((state) => state.user);
  const setCharacterId = useAppStore((state) => state.setCharacterId);
  const saveAvatar = useAvatarStore((state) => state.save);

  return (
    <ProfileSetupScreen
      defaultName={user?.name ?? ''}
      onComplete={({ characterId, avatarConfig }) => {
        setCharacterId(characterId);
        void saveAvatar(avatarConfig);
        router.replace('/home');
      }}
    />
  );
}
