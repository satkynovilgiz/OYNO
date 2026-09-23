import { router } from 'expo-router';

import { OfflineDownloadsScreen } from '@/features/offline/OfflineDownloadsScreen';

export default function OfflineDownloadsRoute() {
  return <OfflineDownloadsScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/saved'))} />;
}
