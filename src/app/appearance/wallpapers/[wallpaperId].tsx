import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { WallpaperPreviewScreen } from '@/features/appearance/WallpaperPreviewScreen';
import { getWallpaper } from '@/features/appearance/wallpapers';
import { colors } from '@/theme';

export default function WallpaperPreviewRoute() {
  const { t } = useTranslation();
  const { wallpaperId } = useLocalSearchParams<{ wallpaperId: string }>();
  const wallpaper = getWallpaper(wallpaperId ?? '');

  if (!wallpaper) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>{t('explore.locationDetail.notFound')}</Text>
      </View>
    );
  }

  return <WallpaperPreviewScreen wallpaper={wallpaper} onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/appearance/wallpapers'))} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  message: { color: colors.textSecondary },
});
