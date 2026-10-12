import { router } from 'expo-router';

import { RecoveryScreen } from '@/features/recovery/RecoveryScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function RecoveryRoute() {
  return <RecoveryScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/profile' as never))} />;
}
