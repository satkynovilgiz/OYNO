import { router } from 'expo-router';

import { KomuzListeningRoomScreen } from '@/features/culture/komuz/listening/KomuzListeningRoomScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function KomuzListenRoute() {
  return <KomuzListeningRoomScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/culture' as never))} />;
}
