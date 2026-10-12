import { router, useLocalSearchParams } from 'expo-router';

import { TagDetailScreen } from '@/features/tags/TagScreens';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function TagRoute() {
  const { tagId } = useLocalSearchParams<{ tagId: string }>();
  return <TagDetailScreen key={String(tagId)} tagId={String(tagId ?? '')} onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/profile/tags' as never))} />;
}
