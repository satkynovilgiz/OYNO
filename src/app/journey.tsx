import { router } from 'expo-router';

import { JourneyScreen } from '@/features/journey/JourneyScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function JourneyRoute() {
  return <JourneyScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/profile'))} />;
}
