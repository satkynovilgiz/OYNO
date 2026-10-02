import { router } from 'expo-router';

import { RhythmTrainerScreen } from '@/features/culture/komuz/rhythm/RhythmTrainerScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function RhythmRoute() {
  return <RhythmTrainerScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/culture/komuz/listen' as never))} />;
}
