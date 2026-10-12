import { router } from 'expo-router';

import { FirstUseScreen } from '@/features/firstUse/FirstUseScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function FirstUseRoute() {
  return <FirstUseScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/home' as never))} />;
}
