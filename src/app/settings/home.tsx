import { router } from 'expo-router';

import { CustomizeHomeScreen } from '@/features/settings/CustomizeHomeScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function CustomizeHomeRoute() {
  return <CustomizeHomeScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/settings' as never))} />;
}
