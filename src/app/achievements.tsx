import { router } from 'expo-router';

import { AchievementsScreen } from '@/features/profile/AchievementsScreen';
import { useProgressStore } from '@/store/useProgressStore';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function AchievementsRoute() {
  const unlockedIds = useProgressStore((state) => state.unlockedAchievementIds);
  return (
    <AchievementsScreen
      unlockedIds={unlockedIds}
      onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/profile'))}
    />
  );
}
