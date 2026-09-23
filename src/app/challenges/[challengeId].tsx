import { router, useLocalSearchParams } from 'expo-router';

import { ChallengeRunScreen } from '@/features/challenges/ChallengeRunScreen';

export default function ChallengeRunRoute() {
  const { challengeId } = useLocalSearchParams<{ challengeId: string }>();
  return <ChallengeRunScreen key={challengeId} challengeId={challengeId ?? 'daily'} onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/challenges'))} />;
}
