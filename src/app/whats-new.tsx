import { router } from 'expo-router';

import { WhatsNewScreen } from '@/features/whatsNew/WhatsNewScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function WhatsNewRoute() {
  return <WhatsNewScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/home' as never))} />;
}
