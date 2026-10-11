import { router } from 'expo-router';

import { BorderWorkshopScreen } from '@/features/culture/oymo/border/BorderWorkshopScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function BorderWorkshopRoute() {
  return <BorderWorkshopScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/culture/oymo/create' as never))} />;
}
