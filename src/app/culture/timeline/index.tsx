import { router } from 'expo-router';

import { CultureTimelineScreen } from '@/features/culture/timeline/CultureTimelineScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function CultureTimelineRoute() {
  return <CultureTimelineScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/culture' as never))} />;
}
