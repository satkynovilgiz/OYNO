import { router, useLocalSearchParams } from 'expo-router';

import { PortfolioScreen } from '@/features/culture/oymo/portfolio/PortfolioScreens';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function OymoPortfolioRoute() {
  const { portfolioId } = useLocalSearchParams<{ portfolioId: string }>();
  return <PortfolioScreen portfolioId={String(portfolioId ?? '')} onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/profile/oymo-portfolios' as never))} />;
}
