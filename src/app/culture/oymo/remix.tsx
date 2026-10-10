import { router } from 'expo-router';

import { RemixStudioScreen } from '@/features/culture/oymo/remix/RemixStudioScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function RemixStudioRoute() {
  return <RemixStudioScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/culture/oymo/create' as never))} />;
}
