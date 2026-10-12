import { router } from 'expo-router';

import { QuestionsListScreen } from '@/features/questions/QuestionsScreens';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function QuestionsRoute() {
  return <QuestionsListScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/profile' as never))} />;
}
