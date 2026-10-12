import { router } from 'expo-router';

import { ColorLabScreen } from '@/features/culture/oymo/colorLab/ColorLabScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function ColorLabRoute() {
  return <ColorLabScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/culture/oymo/create' as never))} />;
}
