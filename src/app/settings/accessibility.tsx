import { router } from 'expo-router';

import { AccessibilityComfortScreen } from '@/features/settings/AccessibilityComfortScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function AccessibilityRoute() {
  return <AccessibilityComfortScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/settings' as never))} />;
}
