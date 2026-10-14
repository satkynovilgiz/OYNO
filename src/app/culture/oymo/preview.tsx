import { router } from 'expo-router';

import { SurfacePreviewScreen } from '@/features/culture/oymo/surfaces/SurfacePreviewScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function SurfacePreviewRoute() {
  return <SurfacePreviewScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/culture/oymo/create' as never))} />;
}
