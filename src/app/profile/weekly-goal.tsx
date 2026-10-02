import { router } from 'expo-router';

import { WeeklyGoalScreen } from '@/features/goals/WeeklyGoalScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function WeeklyGoalRoute() {
  return <WeeklyGoalScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/profile' as never))} />;
}
