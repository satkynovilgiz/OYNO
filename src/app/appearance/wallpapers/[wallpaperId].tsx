import { router, useLocalSearchParams } from 'expo-router';

import { NotFoundState } from '@/components/system/NotFoundState';
import { WallpaperPreviewScreen } from '@/features/appearance/WallpaperPreviewScreen';
import { getWallpaper } from '@/features/appearance/wallpapers';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function WallpaperPreviewRoute() {
  const { wallpaperId } = useLocalSearchParams<{ wallpaperId: string }>();
  const wallpaper = getWallpaper(wallpaperId ?? '');

  if (!wallpaper) {
    return <NotFoundState onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/appearance/wallpapers'))} />;
  }

  return <WallpaperPreviewScreen wallpaper={wallpaper} onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/appearance/wallpapers'))} />;
}

