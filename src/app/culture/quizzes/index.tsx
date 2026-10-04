import { router } from 'expo-router';

import { TopicQuizzesScreen } from '@/features/challenges/topics/TopicQuizzesScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function TopicQuizzesRoute() {
  return <TopicQuizzesScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/culture' as never))} />;
}
