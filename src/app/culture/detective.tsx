import { router } from 'expo-router';

import { DetectiveScreen } from '@/features/detective/DetectiveScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function CultureDetectiveRoute() {
  return <DetectiveScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/culture' as never))} />;
}
