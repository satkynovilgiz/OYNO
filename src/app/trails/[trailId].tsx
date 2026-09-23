import { router, useLocalSearchParams } from 'expo-router';

import { NotFoundState } from '@/components/system/NotFoundState';
import { TrailDetailScreen } from '@/features/trails/TrailDetailScreen';
import { getTrail } from '@/features/trails/trailsData';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function TrailRoute() {
  const { trailId } = useLocalSearchParams<{ trailId: string }>();
  const trail = getTrail(trailId ?? '');

  if (!trail) {
    return <NotFoundState onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/explore'))} />;
  }

  return <TrailDetailScreen trail={trail} onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/explore'))} />;
}

