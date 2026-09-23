import { router } from 'expo-router';

import { SearchScreen } from '@/features/search/SearchScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function SearchRoute() {
  return (
    <SearchScreen
      onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/home'))}
      onPressResult={(route) => router.push(route as never)}
    />
  );
}
