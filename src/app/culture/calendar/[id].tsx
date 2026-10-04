import { router, useLocalSearchParams } from 'expo-router';

import { CalendarEventScreen } from '@/features/culture/calendar/CulturalCalendarScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function CalendarEventRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <CalendarEventScreen id={typeof id === 'string' ? id : ''} onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/culture/calendar' as never))} />;
}
