import { router } from 'expo-router';

import { PrepareOfflineScreen } from '@/features/offline/PrepareOfflineScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function PrepareOfflineRoute() {
  return <PrepareOfflineScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/offline' as never))} />;
}
