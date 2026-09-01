import { router } from 'expo-router';

import { ShyrdakCreatorScreen } from '@/features/culture/shyrdak/ShyrdakCreatorScreen';

export default function ShyrdakCreateRoute() {
  return <ShyrdakCreatorScreen onPressBack={() => router.back()} />;
}
