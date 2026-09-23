import { router, useLocalSearchParams } from 'expo-router';

import { NotFoundState } from '@/components/system/NotFoundState';
import { ChallengeRunScreen } from '@/features/challenges/ChallengeRunScreen';
import { getCollection } from '@/features/collections/collectionsData';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

/** Only real challenges run; anything else (an old or mistyped link) must
 * not silently fall through to the Journey Challenge and record results. */
function isKnownChallenge(challengeId: string): boolean {
  if (challengeId === 'daily' || challengeId === 'journey') return true;
  return challengeId.startsWith('collection-') && !!getCollection(challengeId.slice('collection-'.length));
}

export default function ChallengeRunRoute() {
  const { challengeId = 'daily' } = useLocalSearchParams<{ challengeId: string }>();
  const onPressBack = () => (router.canGoBack() ? router.back() : router.replace('/challenges'));
  if (!isKnownChallenge(challengeId)) return <NotFoundState onPressBack={onPressBack} />;
  return <ChallengeRunScreen key={challengeId} challengeId={challengeId} onPressBack={onPressBack} />;
}
