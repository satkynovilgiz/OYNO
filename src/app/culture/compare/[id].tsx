import { router, useLocalSearchParams } from 'expo-router';

import { CultureCompareScreen } from '@/features/culture/compare/CultureCompareScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

/** /culture/compare/[id] - one curated comparison (unknown id -> a calm fallback). */
export default function CultureCompareRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <CultureCompareScreen id={typeof id === 'string' ? id : ''} onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/culture/compare' as never))} />;
}
