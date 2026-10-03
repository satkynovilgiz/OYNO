import { router } from 'expo-router';

import { CultureCompareListScreen } from '@/features/culture/compare/CultureCompareScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

/** /culture/compare - curated pairs of culture items. */
export default function CultureCompareListRoute() {
  return <CultureCompareListScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/culture' as never))} />;
}
