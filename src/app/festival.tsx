import { router } from 'expo-router';

import { FestivalScreen } from '@/features/festival/FestivalScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function FestivalRoute() {
  return <FestivalScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/home' as never))} />;
}
