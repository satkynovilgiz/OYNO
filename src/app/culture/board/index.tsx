import { router, useLocalSearchParams } from 'expo-router';

import { BoardStartScreen } from '@/features/culture/board/DiscoveryBoardScreens';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function DiscoveryBoardsRoute() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  return <BoardStartScreen from={typeof from === 'string' ? from : null} onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/culture' as never))} />;
}
