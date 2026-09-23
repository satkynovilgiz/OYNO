import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { TrailDetailScreen } from '@/features/trails/TrailDetailScreen';
import { getTrail } from '@/features/trails/trailsData';
import { colors } from '@/theme';

export default function TrailRoute() {
  const { t } = useTranslation();
  const { trailId } = useLocalSearchParams<{ trailId: string }>();
  const trail = getTrail(trailId ?? '');

  if (!trail) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>{t('explore.locationDetail.notFound')}</Text>
      </View>
    );
  }

  return <TrailDetailScreen trail={trail} onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/explore'))} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  message: { color: colors.textSecondary },
});
