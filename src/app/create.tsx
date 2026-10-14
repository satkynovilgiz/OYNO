import { router } from 'expo-router';

import { CreateHubScreen } from '@/features/home/primary/CreateHubScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function CreateRoute() {
  return <CreateHubScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/home' as never))} />;
}
