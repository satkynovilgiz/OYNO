import { router } from 'expo-router';

import { RepeatRhythmScreen } from '@/features/culture/komuz/rhythm/repeat/RepeatRhythmScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function RepeatRhythmRoute() {
  return <RepeatRhythmScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/culture/komuz/listen' as never))} />;
}
