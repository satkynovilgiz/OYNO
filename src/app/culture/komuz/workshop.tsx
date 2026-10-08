import { router } from 'expo-router';

import { RhythmWorkshopScreen } from '@/features/culture/komuz/rhythm/workshop/RhythmWorkshopScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function RhythmWorkshopRoute() {
  return <RhythmWorkshopScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/culture/komuz/repeat' as never))} />;
}
