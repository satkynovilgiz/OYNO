import { router, useLocalSearchParams } from 'expo-router';

import { MilestoneGalleryScreen } from '@/features/culture/oymo/milestones/MilestoneScreens';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function MilestoneGalleryRoute() {
  const { creationId } = useLocalSearchParams<{ creationId: string }>();
  return <MilestoneGalleryScreen creationId={String(creationId ?? '')} onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/culture/oymo/milestones' as never))} />;
}
