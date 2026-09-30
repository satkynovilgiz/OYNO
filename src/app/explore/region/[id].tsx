import { router, useLocalSearchParams } from 'expo-router';

import { RegionHubScreen } from '@/features/explore/regions/RegionHubScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function RegionHubRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <RegionHubScreen regionId={id ?? ''} onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/explore'))} />;
}
