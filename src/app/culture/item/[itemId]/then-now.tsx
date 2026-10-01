import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { OfflineUnavailable } from '@/components/offline/OfflineUnavailable';
import { NotFoundState } from '@/components/system/NotFoundState';
import { cultureItemImages } from '@/features/culture/data';
import { ThenAndNowScreen } from '@/features/culture/thenNow/ThenAndNowScreen';
import { useCultureItem } from '@/services/content/cultureItemsService';
import { isWaitingForNetwork } from '@/services/offline/offlineManifest';
import { colors } from '@/theme';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function CultureThenNowRoute() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const itemQuery = useCultureItem(itemId ?? '');
  const { data: item, isLoading } = itemQuery;
  const back = () => (router.canGoBack() ? router.back() : router.replace(`/culture/item/${itemId}` as never));

  if (isWaitingForNetwork(itemQuery)) return <OfflineUnavailable onRetry={() => void itemQuery.refetch()} />;
  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (!item) return <NotFoundState onPressBack={back} />;
  const image = item.image_url ? { uri: item.image_url } : (cultureItemImages[item.id]?.[0] ?? null);
  return <ThenAndNowScreen item={item} image={image} onPressBack={back} />;
}

const styles = StyleSheet.create({ center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background } });
