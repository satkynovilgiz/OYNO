import { router, useLocalSearchParams } from 'expo-router';

import { CompareScreen } from '@/features/culture/komuz/listening/ListeningCompareScreens';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function ListeningCompareSessionRoute() {
  const { comparisonId } = useLocalSearchParams<{ comparisonId: string }>();
  return <CompareScreen comparisonId={String(comparisonId ?? '')} onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/culture/komuz/compare' as never))} />;
}
