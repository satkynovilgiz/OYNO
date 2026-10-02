import { router } from 'expo-router';

import { ChallengeRunScreen } from '@/features/challenges/ChallengeRunScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

/** /challenges/review - Review mistakes: the normal challenge screen, fed
 * by the private mistakes queue; never touches challenge scores. */
export default function ChallengeReviewRoute() {
  return <ChallengeRunScreen challengeId="review" onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/challenges' as never))} />;
}
