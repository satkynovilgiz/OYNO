import { router } from 'expo-router';

import { SearchScreen } from '@/features/explore/SearchScreen';
import { useDiscoveries } from '@/services/content/discoveriesService';
import type { SearchItem } from '@/services/explore/search';

export default function ExploreSearchRoute() {
  const { data: discoveries } = useDiscoveries();

  function handlePressResult(item: SearchItem) {
    if (item.kind === 'discovery') {
      const regionId = discoveries?.find((d) => d.id === item.id)?.region_id;
      router.push((regionId ? `/explore/${regionId}` : '/explore') as never);
      return;
    }
    router.push(`/explore/${item.id}` as never);
  }

  return <SearchScreen onPressBack={() => router.back()} onPressResult={handlePressResult} />;
}
