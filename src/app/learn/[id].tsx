import { router, useLocalSearchParams } from 'expo-router';

import { LearningPathScreen } from '@/features/learn/LearningPathScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function LearningPathRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <LearningPathScreen pathId={String(id ?? '')} onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/culture' as never))} />;
}
