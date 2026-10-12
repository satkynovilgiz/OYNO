import { router } from 'expo-router';

import { CustomMotifListScreen } from '@/features/culture/oymo/customMotif/CustomMotifScreens';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function CustomMotifsRoute() {
  return <CustomMotifListScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/culture/oymo/create' as never))} />;
}
