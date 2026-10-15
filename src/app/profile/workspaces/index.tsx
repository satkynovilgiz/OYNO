import { router } from 'expo-router';

import { WorkspacesScreen } from '@/features/workspace/WorkspacesScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function WorkspacesRoute() {
  return <WorkspacesScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/profile' as never))} />;
}
