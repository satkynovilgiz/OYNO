import { router, useLocalSearchParams } from 'expo-router';

import { BoardScreen } from '@/features/culture/board/DiscoveryBoardScreens';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function DiscoveryBoardRoute() {
  const { boardId } = useLocalSearchParams<{ boardId: string }>();
  return <BoardScreen boardId={String(boardId ?? '')} onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/culture/board' as never))} />;
}
