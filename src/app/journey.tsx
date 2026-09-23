import { router } from 'expo-router';

import { JourneyScreen } from '@/features/journey/JourneyScreen';

export default function JourneyRoute() {
  return <JourneyScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/profile'))} />;
}
