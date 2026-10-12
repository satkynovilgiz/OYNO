import { router, useLocalSearchParams } from 'expo-router';

import { ExplainScreen } from '@/features/explain/ExplainScreens';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function ExplainRoute() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  return <ExplainScreen articleId={String(itemId ?? '')} onPressBack={() => (router.canGoBack() ? router.back() : router.replace(`/culture/item/${encodeURIComponent(String(itemId ?? ''))}` as never))} />;
}
