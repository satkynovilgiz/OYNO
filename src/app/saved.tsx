import { router } from 'expo-router';

import { SavedScreen } from '@/features/saved/SavedScreen';

export default function SavedRoute() {
  return (
    <SavedScreen
      onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/profile'))}
      onPressItem={(route) => router.push(route as never)}
    />
  );
}
