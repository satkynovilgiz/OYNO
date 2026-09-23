import { router } from 'expo-router';

import { DailyDiscoveryScreen } from '@/features/daily/DailyDiscoveryScreen';

export default function DailyDiscoveryRoute() {
  return <DailyDiscoveryScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/home'))} />;
}
