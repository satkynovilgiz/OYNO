import { router } from 'expo-router';

import { MilestoneDesignsScreen } from '@/features/culture/oymo/milestones/MilestoneScreens';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function MilestoneDesignsRoute() {
  return <MilestoneDesignsScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/culture/oymo/create' as never))} />;
}
