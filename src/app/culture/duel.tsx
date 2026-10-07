import { router } from 'expo-router';

import { DuelScreen } from '@/features/duel/DuelScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function CultureDuelRoute() {
  return <DuelScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/culture' as never))} />;
}
