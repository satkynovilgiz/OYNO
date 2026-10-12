import { router, useLocalSearchParams } from 'expo-router';

import { ConnectionMapScreen } from '@/features/culture/connections/ConnectionMapScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function ConnectionMapRoute() {
  const { start, type } = useLocalSearchParams<{ start?: string; type?: string }>();
  return <ConnectionMapScreen start={{ type: type === 'culture_material' ? 'culture_material' : 'culture_item', id: String(start ?? '') }} onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/culture' as never))} />;
}
