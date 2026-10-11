import { router, useLocalSearchParams } from 'expo-router';

import { ScrapbookScreen } from '@/features/scrapbook/ScrapbookScreens';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function ScrapbookRoute() {
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  return <ScrapbookScreen bookId={String(bookId ?? '')} onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/profile/scrapbooks' as never))} />;
}
