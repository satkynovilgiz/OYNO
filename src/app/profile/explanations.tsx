import { router } from 'expo-router';

import { ExplanationsListScreen } from '@/features/explain/ExplainScreens';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function ExplanationsRoute() {
  return <ExplanationsListScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/profile' as never))} />;
}
