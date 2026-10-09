import { router } from 'expo-router';

import { ConnectionQuestScreen } from '@/features/culture/connections/ConnectionQuestScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

/** /culture/connections/quest - Connection Quest. */
export default function ConnectionQuestRoute() {
  return <ConnectionQuestScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/culture' as never))} />;
}
