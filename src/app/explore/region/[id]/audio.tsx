import { router, useLocalSearchParams } from 'expo-router';

import { RegionAudioJourneyScreen } from '@/features/explore/regions/RegionAudioJourneyScreen';
import { regionHubRoute } from '@/features/explore/regions/regionExperiences';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function RegionAudioJourneyRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <RegionAudioJourneyScreen regionId={id ?? ''} onPressBack={() => (router.canGoBack() ? router.back() : router.replace(regionHubRoute(id ?? '') as never))} />;
}
