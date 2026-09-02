import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { cultureItemAudio } from '@/features/culture/audioData';
import { cultureItemImages } from '@/features/culture/data';
import { CultureItemDetailScreen } from '@/features/culture/CultureItemDetailScreen';
import { useCultureItem } from '@/services/content/cultureItemsService';
import { useProgressStore } from '@/store/useProgressStore';
import { colors } from '@/theme';

export default function CultureItemRoute() {
  const { t } = useTranslation();
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const { data: item, isLoading, error } = useCultureItem(itemId ?? '');

  useEffect(() => {
    if (!item) return;
    void useProgressStore.getState().advanceQuestStep('OPEN_CULTURE_ITEM', item.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error || !item) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>{t('culture.loadError')}</Text>
      </View>
    );
  }

  return (
    <CultureItemDetailScreen
      item={item}
      images={cultureItemImages[item.id]}
      audioTracks={cultureItemAudio[item.id]}
      onPressBack={() => router.back()}
    />
  );
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
