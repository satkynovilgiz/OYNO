import { router } from 'expo-router';

import { JournalCollageScreen } from '@/features/journal/collage/JournalCollageScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

/** /journal/collage - a private collage of your own Journal memories. */
export default function JournalCollageRoute() {
  return <JournalCollageScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/journal' as never))} />;
}
