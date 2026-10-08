import { router, useLocalSearchParams } from 'expo-router';

import { RecipePlayerScreen } from '@/features/culture/oymo/recipe/RecipePlayerScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

/** /culture/oymo/recipe?creation=<saved id> | ?source=session - Pattern Recipe player. */
export default function RecipeRoute() {
  const { creation } = useLocalSearchParams<{ creation?: string }>();
  return <RecipePlayerScreen creationId={typeof creation === 'string' && creation ? creation : null} onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/culture/oymo/create' as never))} />;
}
