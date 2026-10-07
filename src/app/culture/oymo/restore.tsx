import { router } from 'expo-router';

import { RestorePatternScreen } from '@/features/culture/oymo/restore/RestorePatternScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function RestorePatternRoute() {
  return <RestorePatternScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/culture/oymo/create' as never))} />;
}
