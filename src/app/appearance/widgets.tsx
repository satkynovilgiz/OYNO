import { router } from 'expo-router';

import { WidgetsScreen } from '@/features/appearance/WidgetsScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function AppearanceWidgetsRoute() {
  return <WidgetsScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/appearance'))} />;
}
