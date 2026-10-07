import { router } from 'expo-router';

import { MapChallengeScreen } from '@/features/explore/mapChallenge/MapChallengeScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function MapChallengeRoute() {
  return <MapChallengeScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/explore/map' as never))} />;
}
