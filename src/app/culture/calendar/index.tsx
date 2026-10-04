import { router } from 'expo-router';

import { CulturalCalendarScreen } from '@/features/culture/calendar/CulturalCalendarScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function CulturalCalendarRoute() {
  return <CulturalCalendarScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/culture' as never))} />;
}
