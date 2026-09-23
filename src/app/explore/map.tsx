import { router } from 'expo-router';

import { InteractiveMapScreen } from '@/features/explore/map/InteractiveMapScreen';

export default function ExploreMapRoute() {
  return <InteractiveMapScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/explore'))} />;
}
