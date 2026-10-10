import { router } from 'expo-router';

import { PatternDetectiveScreen } from '@/features/culture/oymo/symmetry/PatternDetectiveScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function PatternDetectiveRoute() {
  return <PatternDetectiveScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/culture/oymo/create' as never))} />;
}
