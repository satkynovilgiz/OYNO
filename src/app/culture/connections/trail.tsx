import { router, useLocalSearchParams } from 'expo-router';

import { ConnectionTrailScreen } from '@/features/culture/connections/ConnectionTrailScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

/** /culture/connections/trail?start=<id>[&type=culture_material] - "Follow the Connection". */
export default function ConnectionTrailRoute() {
  const { start, type } = useLocalSearchParams<{ start?: string; type?: string }>();
  return <ConnectionTrailScreen startType={type === 'culture_material' ? 'culture_material' : 'culture_item'} startId={String(start ?? '')} onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/culture' as never))} />;
}
