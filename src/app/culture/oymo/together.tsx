import { router } from 'expo-router';

import { CreateTogetherScreen } from '@/features/culture/oymo/together/CreateTogetherScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function CreateTogetherRoute() {
  return <CreateTogetherScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/culture/oymo/create' as never))} />;
}
