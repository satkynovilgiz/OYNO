import { router } from 'expo-router';

import { StorageScreen } from '@/features/settings/StorageScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function StorageRoute() {
  return <StorageScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/settings/data-privacy' as never))} />;
}
