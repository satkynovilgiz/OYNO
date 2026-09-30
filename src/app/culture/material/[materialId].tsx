import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { OfflineUnavailable } from '@/components/offline/OfflineUnavailable';
import { NotFoundState } from '@/components/system/NotFoundState';
import { MaterialDetailScreen } from '@/features/culture/MaterialDetailScreen';
import { useCultureMaterial } from '@/services/content/cultureService';
import { isWaitingForNetwork } from '@/services/offline/offlineManifest';
import { colors } from '@/theme';

export default function CultureMaterialRoute() {
  const { t } = useTranslation();
  const { materialId } = useLocalSearchParams<{ materialId: string }>();
  const materialQuery = useCultureMaterial(materialId ?? '');
  const { data: material, isLoading, error } = materialQuery;

  if (isWaitingForNetwork(materialQuery)) {
    return <OfflineUnavailable onRetry={() => void materialQuery.refetch()} />;
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // Same as a culture item: an unknown id is Not Found, a failed load says
  // so - both with a way back (never a dead end).
  if (error || !material) {
    return <NotFoundState message={error ? t('culture.loadError') : undefined} onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/culture' as never))} />;
  }

  return <MaterialDetailScreen material={material} onPressBack={() => router.back()} />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
