import { router, useLocalSearchParams } from 'expo-router';

import { ConnectionDetailScreen } from '@/features/culture/connections/ConnectionDetailScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

/** /culture/connections/[id] - "Explore the connection". */
export default function CultureConnectionRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ConnectionDetailScreen connectionId={String(id ?? '')} onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/culture' as never))} />;
}
