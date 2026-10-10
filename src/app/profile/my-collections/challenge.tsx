import { router } from 'expo-router';

import { CuratorChallengeScreen } from '@/features/myCollections/museum/CuratorChallengeScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function CuratorChallengeRoute() {
  return <CuratorChallengeScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/profile/my-collections' as never))} />;
}
