import { router } from 'expo-router';

import { KomuzLearnScreen } from '@/features/culture/komuz/KomuzLearnScreen';

export default function KomuzLearnRoute() {
  return <KomuzLearnScreen onPressBack={() => router.back()} />;
}
