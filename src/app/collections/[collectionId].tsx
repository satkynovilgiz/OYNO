import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { CollectionDetailScreen } from '@/features/collections/CollectionDetailScreen';
import { getCollection } from '@/features/collections/collectionsData';
import { colors } from '@/theme';

export default function CollectionRoute() {
  const { t } = useTranslation();
  const { collectionId } = useLocalSearchParams<{ collectionId: string }>();
  const collection = getCollection(collectionId ?? '');

  if (!collection) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>{t('culture.loadError')}</Text>
      </View>
    );
  }

  return <CollectionDetailScreen collection={collection} onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/culture'))} />;
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
