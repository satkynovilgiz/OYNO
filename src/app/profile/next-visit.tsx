import { router } from 'expo-router';

import { NextVisitScreen } from '@/features/nextVisit/NextVisitScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function NextVisitRoute() {
  return <NextVisitScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/profile' as never))} />;
}
