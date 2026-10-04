import { router } from 'expo-router';

import { PortfolioScreen } from '@/features/profile/portfolio/PortfolioScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

/** /profile/portfolio - My Learning Portfolio (private). */
export default function PortfolioRoute() {
  return <PortfolioScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/profile' as never))} />;
}
