import { router } from 'expo-router';

import { CultureGalleryScreen } from '@/features/culture/gallery/CultureGalleryScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function CultureGalleryRoute() {
  return <CultureGalleryScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/culture' as never))} />;
}
