import { router } from 'expo-router';

import { MyReportsScreen } from '@/features/reports/MyReportsScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function MyReportsRoute() {
  return <MyReportsScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/profile' as never))} />;
}
