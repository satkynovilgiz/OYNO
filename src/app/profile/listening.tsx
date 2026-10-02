import { router } from 'expo-router';

import { ListeningScreen } from '@/features/listening/ListeningScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function ListeningRoute() {
  return <ListeningScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/profile' as never))} />;
}
