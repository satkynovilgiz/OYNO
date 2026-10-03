import { router } from 'expo-router';

import { QuickReviewScreen } from '@/features/study/QuickReviewScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

/** /study/quick - Quick review (3 mistakes + 3 glossary cards, reused engines). */
export default function QuickReviewRoute() {
  return <QuickReviewScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/study' as never))} />;
}
