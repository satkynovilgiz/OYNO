import { router } from 'expo-router';

import { HighlightsScreen } from '@/features/culture/highlights/HighlightsScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function HighlightsRoute() {
  return <HighlightsScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/profile' as never))} />;
}
