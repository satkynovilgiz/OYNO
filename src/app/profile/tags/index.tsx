import { router } from 'expo-router';

import { TagsScreen } from '@/features/tags/TagScreens';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function TagsRoute() {
  return <TagsScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/profile' as never))} />;
}
