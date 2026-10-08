import { router } from 'expo-router';

import { BuildFromMemoryScreen } from '@/features/culture/bozUy/BuildFromMemoryScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function BuildFromMemoryRoute() {
  return <BuildFromMemoryScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/culture/boz-uy/build' as never))} />;
}
