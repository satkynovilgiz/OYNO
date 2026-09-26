import { router, useLocalSearchParams } from 'expo-router';

import { QuestDetailScreen } from '@/features/quests/QuestDetailScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function QuestDetailRoute() {
  const { questId = '' } = useLocalSearchParams<{ questId: string }>();
  return <QuestDetailScreen key={questId} questId={questId} onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/quests' as never))} />;
}
