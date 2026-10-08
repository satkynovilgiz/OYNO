import { router } from 'expo-router';

import { SymmetryPlaygroundScreen } from '@/features/culture/oymo/symmetry/SymmetryPlaygroundScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function SymmetryPlaygroundRoute() {
  return <SymmetryPlaygroundScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/culture/oymo/create' as never))} />;
}
