import { router, useLocalSearchParams } from 'expo-router';

import { FreeCompareScreen } from '@/features/culture/compare/FreeCompareScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

/** /culture/compare/pick?left=<id>&right=<id> - compare any two culture items. */
export default function FreeCompareRoute() {
  const { left, right } = useLocalSearchParams<{ left?: string; right?: string }>();
  return <FreeCompareScreen pair={{ left: typeof left === 'string' && left ? left : null, right: typeof right === 'string' && right ? right : null }} onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/culture/compare' as never))} />;
}
