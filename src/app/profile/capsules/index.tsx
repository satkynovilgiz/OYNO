import { router } from 'expo-router';

import { CapsuleListScreen } from '@/features/capsules/CapsuleScreens';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function CapsulesRoute() {
  return <CapsuleListScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/profile' as never))} />;
}
