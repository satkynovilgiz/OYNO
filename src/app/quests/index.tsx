import { router } from 'expo-router';

import { QuestHubScreen } from '@/features/quests/QuestHubScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function QuestsRoute() {
  return <QuestHubScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/home'))} />;
}
