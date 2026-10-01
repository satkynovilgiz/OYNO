import { router } from 'expo-router';

import { MyCollectionsScreen } from '@/features/myCollections/MyCollectionsScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function MyCollectionsRoute() {
  return <MyCollectionsScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/profile' as never))} />;
}
