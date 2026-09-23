import { router } from 'expo-router';

import { AppearanceScreen } from '@/features/appearance/AppearanceScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function AppearanceRoute() {
  return <AppearanceScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/settings'))} />;
}
