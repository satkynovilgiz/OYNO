import { router, useLocalSearchParams } from 'expo-router';

import { MyCollectionDetailScreen } from '@/features/myCollections/MyCollectionDetailScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function MyCollectionDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <MyCollectionDetailScreen collectionId={String(id ?? '')} onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/profile/my-collections' as never))} />;
}
