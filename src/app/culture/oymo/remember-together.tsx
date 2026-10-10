import { router } from 'expo-router';

import { RememberTogetherScreen } from '@/features/culture/oymo/symmetry/RememberTogetherScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function RememberTogetherRoute() {
  return <RememberTogetherScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/culture/oymo/remember' as never))} />;
}
