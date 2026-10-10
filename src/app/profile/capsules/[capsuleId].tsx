import { router, useLocalSearchParams } from 'expo-router';

import { CapsuleScreen } from '@/features/capsules/CapsuleScreens';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function CapsuleRoute() {
  const { capsuleId } = useLocalSearchParams<{ capsuleId: string }>();
  return <CapsuleScreen capsuleId={String(capsuleId ?? '')} onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/profile/capsules' as never))} />;
}
