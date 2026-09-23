import { router, useLocalSearchParams } from 'expo-router';

import { NotFoundState } from '@/components/system/NotFoundState';
import { CollectionDetailScreen } from '@/features/collections/CollectionDetailScreen';
import { getCollection } from '@/features/collections/collectionsData';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function CollectionRoute() {
  const { collectionId } = useLocalSearchParams<{ collectionId: string }>();
  const collection = getCollection(collectionId ?? '');
  const onPressBack = () => (router.canGoBack() ? router.back() : router.replace('/culture'));

  if (!collection) return <NotFoundState onPressBack={onPressBack} />;

  return <CollectionDetailScreen collection={collection} onPressBack={onPressBack} />;
}
