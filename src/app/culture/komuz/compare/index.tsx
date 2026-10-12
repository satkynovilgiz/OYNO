import { router } from 'expo-router';

import { CompareStartScreen } from '@/features/culture/komuz/listening/ListeningCompareScreens';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function ListeningCompareRoute() {
  return <CompareStartScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/culture/komuz/listen' as never))} />;
}
