import { router } from 'expo-router';

import { BozUyBuilderScreen } from '@/features/culture/bozUy/BozUyBuilderScreen';

export default function BozUyBuildRoute() {
  return <BozUyBuilderScreen onPressBack={() => router.back()} />;
}
