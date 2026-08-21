import { router } from 'expo-router';

import { HelpScreen } from '@/features/settings/HelpScreen';

export default function HelpRoute() {
  return <HelpScreen onPressBack={() => router.back()} />;
}
