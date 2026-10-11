import { router } from 'expo-router';

import { ReadingNotesScreen } from '@/features/culture/reading/ReadingNotesScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function ReadingNotesRoute() {
  return <ReadingNotesScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/profile' as never))} />;
}
