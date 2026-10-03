import { router } from 'expo-router';

import { LearningTimelineScreen } from '@/features/timeline/LearningTimelineScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

/** /profile/activity - Learning history (private, derived from existing records). */
export default function LearningHistoryRoute() {
  return <LearningTimelineScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/profile' as never))} />;
}
