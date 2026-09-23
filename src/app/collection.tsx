import { router } from 'expo-router';

import { CollectionScreen } from '@/features/profile/CollectionScreen';
import { useProgressStore } from '@/store/useProgressStore';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function CollectionRoute() {
  const discoveredExploreIds = useProgressStore((state) => state.discoveredExploreIds);
  return (
    <CollectionScreen
      discoveredExploreIds={discoveredExploreIds}
      onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/profile'))}
    />
  );
}
