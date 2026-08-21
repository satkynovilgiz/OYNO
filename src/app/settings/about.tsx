import { router } from 'expo-router';

import { AboutScreen } from '@/features/settings/AboutScreen';

export default function AboutRoute() {
  return <AboutScreen onPressBack={() => router.back()} />;
}
