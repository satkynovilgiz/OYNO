import { router } from 'expo-router';

import { showToast } from '@/components/ui/Toast';
import { ProfileSetupScreen } from '@/features/profileSetup/ProfileSetupScreen';
import i18n from '@/i18n';
import { useAppStore } from '@/store/useAppStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useAvatarStore } from '@/store/useAvatarStore';

export default function ProfileSetupRoute() {
  const user = useAuthStore((state) => state.user);

  return (
    <ProfileSetupScreen
      defaultName={user?.name ?? ''}
      onComplete={async ({ name, characterId, avatarConfig }) => {
        // Three separate saves through the existing stores - the guide never
        // overwrites the avatar or the other way round.
        // 1. Display name (it used to be typed here and then dropped).
        const current = useAuthStore.getState();
        let nameSaved = true;
        if (current.status === 'authenticated' && current.user && name && name !== current.user.name) {
          nameSaved = await current.updateProfile({ name });
          if (!nameSaved) current.clearError();
        }
        // 2. Story companion (local + synced by the app store).
        useAppStore.getState().setCharacterId(characterId);
        // 3. The user's avatar - saved on this phone first; if the upload
        // fails it retries on its own when the connection is back.
        const avatarSynced = await useAvatarStore.getState().save(avatarConfig);

        if (!nameSaved) showToast(i18n.t('profileSetup.v2.nameNotSaved'), { tone: 'info' });
        else if (!avatarSynced) showToast(i18n.t('profileSetup.v2.avatar.willSync'), { tone: 'info' });
        router.replace('/home');
        return true;
      }}
    />
  );
}
