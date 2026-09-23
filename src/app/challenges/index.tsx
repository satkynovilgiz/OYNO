import { router } from 'expo-router';

import { ChallengesHubScreen } from '@/features/challenges/ChallengesHubScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function ChallengesRoute() {
  return <ChallengesHubScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/home'))} />;
}
