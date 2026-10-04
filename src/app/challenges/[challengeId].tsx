import { router, useLocalSearchParams } from 'expo-router';

import { NotFoundState } from '@/components/system/NotFoundState';
import { ChallengeRunScreen } from '@/features/challenges/ChallengeRunScreen';
import { regionForChallengeId } from '@/features/challenges/regionalChallenges';
import { topicFromChallengeId } from '@/features/challenges/topics/topicQuizzes';
import type { RegionExperienceConfig } from '@/features/explore/regions/regionExperiences';
import { useRegionExperiences } from '@/features/explore/regions/useRegionExperiences';
import { getCollection } from '@/features/collections/collectionsData';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

/** Only real challenges run; anything else (an old or mistyped link) must
 * not silently fall through to the Journey Challenge and record results. */
function isKnownChallenge(challengeId: string, regions: readonly RegionExperienceConfig[]): boolean {
  if (challengeId === 'daily' || challengeId === 'journey') return true;
  if (challengeId.startsWith('region-')) return !!regionForChallengeId(challengeId, regions);
  if (challengeId.startsWith('topic-')) return !!topicFromChallengeId(challengeId);
  return challengeId.startsWith('collection-') && !!getCollection(challengeId.slice('collection-'.length));
}

export default function ChallengeRunRoute() {
  const { challengeId = 'daily' } = useLocalSearchParams<{ challengeId: string }>();
  const onPressBack = () => (router.canGoBack() ? router.back() : router.replace('/challenges'));
  const regions = useRegionExperiences();
  if (!isKnownChallenge(challengeId, regions)) return <NotFoundState onPressBack={onPressBack} />;
  return <ChallengeRunScreen key={challengeId} challengeId={challengeId} onPressBack={onPressBack} />;
}
