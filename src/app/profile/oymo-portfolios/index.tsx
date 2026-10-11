import { router } from 'expo-router';

import { PortfolioListScreen } from '@/features/culture/oymo/portfolio/PortfolioScreens';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function OymoPortfoliosRoute() {
  return <PortfolioListScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/profile' as never))} />;
}
