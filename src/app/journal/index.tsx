import { router } from 'expo-router';

import { JournalScreen } from '@/features/journal/JournalScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function JournalRoute() {
  return <JournalScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/journey'))} />;
}
