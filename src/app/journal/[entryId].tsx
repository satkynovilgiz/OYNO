import { router, useLocalSearchParams } from 'expo-router';

import { JournalEntryScreen } from '@/features/journal/JournalEntryScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function JournalEntryRoute() {
  const { entryId } = useLocalSearchParams<{ entryId: string }>();
  return <JournalEntryScreen key={entryId} entryId={entryId} onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/journal'))} />;
}
