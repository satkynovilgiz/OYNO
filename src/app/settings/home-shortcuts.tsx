import { router } from 'expo-router';

import { HomeShortcutsScreen } from '@/features/home/shortcuts/HomeShortcutsScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function HomeShortcutsRoute() {
  return <HomeShortcutsScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/home' as never))} />;
}
