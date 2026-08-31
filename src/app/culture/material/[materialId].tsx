import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { MaterialDetailScreen } from '@/features/culture/MaterialDetailScreen';
import { useCultureMaterial } from '@/services/content/cultureService';
import { colors } from '@/theme';

export default function CultureMaterialRoute() {
  const { t } = useTranslation();
  const { materialId } = useLocalSearchParams<{ materialId: string }>();
  const { data: material, isLoading, error } = useCultureMaterial(materialId ?? '');

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error || !material) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>{t('culture.loadError')}</Text>
      </View>
    );
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
  message: {
    color: colors.textSecondary,
  },
});
