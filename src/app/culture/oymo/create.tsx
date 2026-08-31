import { router } from 'expo-router';

import { OymoCreatorScreen } from '@/features/culture/oymo/OymoCreatorScreen';

export default function OymoCreateRoute() {
  return <OymoCreatorScreen onPressBack={() => router.back()} />;
}
