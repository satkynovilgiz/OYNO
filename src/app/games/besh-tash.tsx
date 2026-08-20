import { router } from 'expo-router';

import { BeshTashScreen } from '@games/beshTash/screens/BeshTashScreen';

export default function BeshTashRoute() {
  return <BeshTashScreen onPressBack={() => router.back()} />;
}
