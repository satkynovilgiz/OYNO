import { router } from 'expo-router';

import { GlossaryScreen } from '@/features/culture/glossary/GlossaryScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function GlossaryRoute() {
  return <GlossaryScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/culture' as never))} />;
}
