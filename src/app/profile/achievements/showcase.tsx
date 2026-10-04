import { router } from 'expo-router';

import { ShowcaseManageScreen } from '@/features/profile/showcase/AchievementShowcase';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function ShowcaseRoute() {
  return <ShowcaseManageScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/profile' as never))} />;
}
