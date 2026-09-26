import { router } from 'expo-router';

import { NotFoundState } from '@/components/system/NotFoundState';
import { Game3DLabScreen } from '@/games3d/core/Game3DLabScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

/** Developer tool only: production / TestFlight builds show the normal
 * not-found screen even when opened by deep link (oyno://games/3d-lab). */
export default function Game3DLabRoute() {
  if (!__DEV__) return <NotFoundState onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/games'))} />;
  return <Game3DLabScreen />;
}
