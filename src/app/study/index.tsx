import { router } from 'expo-router';

import { StudyQueueScreen } from '@/features/study/StudyQueueScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

/** /study - My Study Queue (private, derived; no tab of its own). */
export default function StudyQueueRoute() {
  return <StudyQueueScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/profile' as never))} />;
}
