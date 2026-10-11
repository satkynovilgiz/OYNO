import { router } from 'expo-router';

import { ShelfScreen } from '@/features/shelf/ShelfScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function ShelfRoute() {
  return <ShelfScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/profile' as never))} />;
}
