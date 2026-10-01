import { router } from 'expo-router';

import { GameRecordsOverviewScreen } from '@/features/games/records/GameRecordsOverviewScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function GameRecordsRoute() {
  return <GameRecordsOverviewScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/profile' as never))} />;
}
