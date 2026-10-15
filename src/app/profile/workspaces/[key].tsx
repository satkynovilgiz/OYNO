import { router, useLocalSearchParams } from 'expo-router';

import { WorkspaceScreen } from '@/features/workspace/WorkspaceScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function WorkspaceRoute() {
  const { key } = useLocalSearchParams<{ key: string }>();
  return <WorkspaceScreen projectKey={String(key ?? '')} onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/profile/workspaces' as never))} />;
}
