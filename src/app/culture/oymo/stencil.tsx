import { router } from 'expo-router';

import { StencilStudioScreen } from '@/features/culture/oymo/stencil/StencilStudioScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function StencilStudioRoute() {
  return <StencilStudioScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/culture/oymo/create' as never))} />;
}
