import { router } from 'expo-router';
import { useMemo } from 'react';

import { AvatarEditorScreen } from '@/features/avatar/AvatarEditorScreen';
import { AVATAR_CATALOG } from '@/services/avatar/avatarCatalog';
import { getUnlockedItemIds } from '@/services/avatar/avatarUnlocks';
import { useAvatarStore } from '@/store/useAvatarStore';
import { useProgressStore } from '@/store/useProgressStore';

export default function AvatarEditorRoute() {
  const config = useAvatarStore((state) => state.config);
  const isSaving = useAvatarStore((state) => state.isSaving);
  const lastSyncError = useAvatarStore((state) => state.lastSyncError);
  const save = useAvatarStore((state) => state.save);

  const gamesPlayed = useProgressStore((state) => state.gamesPlayed);
  const cultureDiscoveryCount = useProgressStore((state) => state.cultureDiscoveryCount);
  const questFoundCount = useProgressStore((state) => state.questFoundCount);
  const streakDays = useProgressStore((state) => state.streakDays);
  const xp = useProgressStore((state) => state.xp);

  const unlockedItemIds = useMemo(
    () => getUnlockedItemIds(AVATAR_CATALOG, { gamesPlayed, cultureDiscoveryCount, questFoundCount, streakDays, xp }),
    [gamesPlayed, cultureDiscoveryCount, questFoundCount, streakDays, xp],
  );

  return (
    <AvatarEditorScreen
      mode="standalone"
      initialConfig={config}
      unlockedItemIds={unlockedItemIds}
      isSaving={isSaving}
      saveError={lastSyncError}
      onComplete={async (next) => {
        const ok = await save(next);
        if (ok) router.back();
      }}
      onCancel={() => router.back()}
    />
  );
}
