import { router } from 'expo-router';

import { RememberPatternScreen } from '@/features/culture/oymo/symmetry/RememberPatternScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function RememberPatternRoute() {
  return <RememberPatternScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/culture/oymo/create' as never))} />;
}
