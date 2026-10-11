import { router } from 'expo-router';

import { MysteryObjectScreen } from '@/features/culture/mystery/MysteryObjectScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function MysteryObjectRoute() {
  return <MysteryObjectScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/culture' as never))} />;
}
