import { router, useLocalSearchParams } from 'expo-router';

import { PostcardScreen } from '@/features/culture/oymo/postcard/PostcardScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function PostcardRoute() {
  const { pattern } = useLocalSearchParams<{ pattern?: string }>();
  return <PostcardScreen patternId={typeof pattern === 'string' ? pattern : ''} onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/culture/oymo/create' as never))} />;
}
