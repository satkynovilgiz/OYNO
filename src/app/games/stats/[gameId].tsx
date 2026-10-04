import { router, useLocalSearchParams } from 'expo-router';

import { GameStatsDetailScreen } from '@/features/games/stats/GameStatsScreens';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

/** /games/stats/[gameId] - one game's recent performance. */
export default function GameStatsDetailRoute() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  return <GameStatsDetailScreen gameId={String(gameId ?? '')} onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/games/stats' as never))} />;
}
