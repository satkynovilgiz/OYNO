import { router } from 'expo-router';

import { RecapScreen } from '@/features/profile/recap/RecapScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function RecapRoute() {
  return <RecapScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/profile' as never))} />;
}
