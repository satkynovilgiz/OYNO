import { router } from 'expo-router';

import { FocusSessionScreen } from '@/features/study/session/FocusSessionScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

/** /study/session - Study Planner + Focus Sessions (reused engines). */
export default function FocusSessionRoute() {
  return <FocusSessionScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/study' as never))} />;
}
