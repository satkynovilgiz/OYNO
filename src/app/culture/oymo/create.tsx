import { router, useLocalSearchParams } from 'expo-router';

import { OymoCreatorScreen } from '@/features/culture/oymo/OymoCreatorScreen';

export default function OymoCreateRoute() {
  const { creation } = useLocalSearchParams<{ creation?: string }>();
  return <OymoCreatorScreen onPressBack={() => router.back()} initialCreationId={typeof creation === 'string' ? creation : null} />;
}
