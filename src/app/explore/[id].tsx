import { router, useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';

import { exploreLocations, getExploreLocationById } from '@/features/explore/data';
import { LocationDetailScreen } from '@/features/explore/LocationDetailScreen';

export default function ExploreLocationRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const location = getExploreLocationById(id);

  if (!location) {
    return <Text>Location not found</Text>;
  }

  const sameKind = exploreLocations.filter((item) => item.kind === location.kind);
  const toneIndex = Math.max(
    0,
    sameKind.findIndex((item) => item.id === location.id),
  );

  return (
    <LocationDetailScreen location={location} toneIndex={toneIndex} onPressBack={() => router.back()} />
  );
}
