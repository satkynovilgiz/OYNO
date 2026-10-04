import { router } from 'expo-router';

import { GameStatsScreen } from '@/features/games/stats/GameStatsScreens';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

/** /games/stats - My Game Stats (recent rounds, per game). */
export default function GameStatsRoute() {
  return <GameStatsScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/games' as never))} />;
}
