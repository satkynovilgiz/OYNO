import { router } from 'expo-router';

import { DiscoveryRecapScreen } from '@/features/discoveryRecap/DiscoveryRecapScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function DiscoveryRecapRoute() {
  return <DiscoveryRecapScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/profile' as never))} />;
}
