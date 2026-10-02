import { router, useLocalSearchParams } from 'expo-router';

import { GlossaryStudyScreen } from '@/features/culture/glossary/study/GlossaryStudyScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function GlossaryStudyRoute() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const safeMode = mode === 'all' || mode === 'review' ? mode : 'five';
  return <GlossaryStudyScreen key={safeMode} mode={safeMode} onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/culture/glossary' as never))} />;
}
