import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { OfflineUnavailable } from '@/components/offline/OfflineUnavailable';
import { NotFoundState } from '@/components/system/NotFoundState';
import { SourceExplorerScreen } from '@/features/culture/sources/SourceExplorerScreen';
import { useCultureMaterial } from '@/services/content/cultureService';
import { isWaitingForNetwork } from '@/services/offline/offlineManifest';
import { colors } from '@/theme';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

/** Source Explorer for one material (its own sources only). */
export default function SourceExplorerRoute() {
  const { materialId } = useLocalSearchParams<{ materialId: string }>();
  const query = useCultureMaterial(materialId ?? '');
  const back = () => (router.canGoBack() ? router.back() : router.replace(`/culture/material/${materialId}` as never));
  if (isWaitingForNetwork(query)) return <OfflineUnavailable onRetry={() => void query.refetch()} />;
  if (query.isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  const row = query.data;
  if (!row) return <NotFoundState onPressBack={back} />;
  return <SourceExplorerScreen contentType="culture_material" contentId={row.id} title={row.title} level={row.accuracy_level} sources={row.sources} onPressBack={back} />;
}
