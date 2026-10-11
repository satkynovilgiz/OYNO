import { router } from 'expo-router';

import { ScrapbookListScreen } from '@/features/scrapbook/ScrapbookScreens';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function ScrapbooksRoute() {
  return <ScrapbookListScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/profile' as never))} />;
}
