import { router, useLocalSearchParams } from 'expo-router';

import { MiniMuseumScreen } from '@/features/myCollections/museum/MiniMuseumScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function MiniMuseumRoute() {
  const { collection } = useLocalSearchParams<{ collection?: string }>();
  return <MiniMuseumScreen collectionId={String(collection ?? '')} onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/profile/my-collections' as never))} />;
}
