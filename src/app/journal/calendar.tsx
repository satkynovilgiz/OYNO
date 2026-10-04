import { router } from 'expo-router';

import { JournalCalendarScreen } from '@/features/journal/calendar/JournalCalendarScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

/** /journal/calendar - private Journal by memory date. */
export default function JournalCalendarRoute() {
  return <JournalCalendarScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/journal' as never))} />;
}
