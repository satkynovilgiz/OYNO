import { router } from 'expo-router';

import { CollectionScreen } from '@/features/profile/CollectionScreen';

export default function CollectionRoute() {
  return <CollectionScreen onPressBack={() => router.back()} />;
}
