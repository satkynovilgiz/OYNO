import { router } from 'expo-router';

import { WallpapersScreen } from '@/features/appearance/WallpapersScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function AppearanceWallpapersRoute() {
  return <WallpapersScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/appearance'))} />;
}
